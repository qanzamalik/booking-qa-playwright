import { test, expect } from '../support/fixtures';
import { RATES, expectStatus } from '../support/booking-api';

/**
 * Money checks. A booking can show "CONFIRMED" and a receipt can be generated
 * while the commission or payout is wrong, so these tests check the numbers,
 * not just the status.
 */
test.describe('Pricing, commission and supplier payout', () => {
  const cases = [
    { tourId: 'T100', travellers: 1 },
    { tourId: 'T100', travellers: 3 },
    { tourId: 'T200', travellers: 4 }, // $149.50 price → checks rounding on half-cents
    { tourId: 'T300', travellers: 1 }, // $1,249.99 → odd cents
    { tourId: 'T400', travellers: 9 }, // max travellers, largest amount
  ];

  for (const { tourId, travellers } of cases) {
    test(`${tourId} × ${travellers}: totals, commission and payout reconcile`, async ({ api }) => {
      const tour = await api.getTour(tourId);
      const booking = await api.confirmedBooking(tourId, travellers);

      const expectedBase = tour.priceCents * travellers;
      const expectedTax = Math.round(expectedBase * RATES.tax);
      const expectedCommission = Math.round(expectedBase * RATES.commission);

      expect(booking.baseCents).toBe(expectedBase);
      expect(booking.taxCents).toBe(expectedTax);
      expect(booking.totalCents).toBe(expectedBase + expectedTax);
      expect(booking.commissionCents).toBe(expectedCommission);

      // The platform must always take its cut: commission is never zero on a paid booking
      expect(booking.commissionCents).toBeGreaterThan(0);

      // Every cent of the base price is accounted for: supplier payout + commission = base
      expect(booking.supplierPayoutCents + booking.commissionCents).toBe(booking.baseCents);

      // All amounts are whole cents (no floating-point leaks)
      for (const key of ['baseCents', 'taxCents', 'totalCents', 'commissionCents', 'supplierPayoutCents'] as const) {
        expect(Number.isInteger(booking[key]), `${key} must be integer cents`).toBeTruthy();
      }
    });
  }
});

test.describe('Refund policy by days before departure', () => {
  // T100 departs 2027-06-10
  const policy = [
    { today: '2027-01-01', expectedPct: 100, why: 'far out' },
    { today: '2027-05-11', expectedPct: 100, why: 'exactly 30 days (boundary)' },
    { today: '2027-05-12', expectedPct: 50, why: '29 days (just inside 50% window)' },
    { today: '2027-06-03', expectedPct: 50, why: 'exactly 7 days (boundary)' },
    { today: '2027-06-04', expectedPct: 0, why: '6 days (no refund)' },
    { today: '2027-06-10', expectedPct: 0, why: 'departure day' },
  ];

  for (const { today, expectedPct, why } of policy) {
    test(`cancel on ${today} → ${expectedPct}% refund (${why})`, async ({ api }) => {
      const booking = await api.confirmedBooking('T100', 2);
      const res = await api.cancel(booking.ref, today);
      await expectStatus(res, 200);
      const cancelled = await res.json();

      expect(cancelled.refundPercent).toBe(expectedPct);
      expect(cancelled.refundCents).toBe(Math.round((booking.totalCents * expectedPct) / 100));
      // A refund can never exceed what the customer paid
      expect(cancelled.refundCents).toBeLessThanOrEqual(booking.totalCents);
    });
  }
});
