import { test, expect } from '../support/fixtures';
import { CARDS, defaultGuest, expectStatus } from '../support/booking-api';

test.describe('Booking lifecycle: create → pay → cancel', () => {
  test('happy path moves through every status and keeps inventory correct', async ({ api }) => {
    const seatsBefore = (await api.getTour('T100')).seats;

    const created = await api.createBooking({ tourId: 'T100', travellers: 2, ...defaultGuest });
    await expectStatus(created, 201);
    const booking = await created.json();
    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.ref).toMatch(/^RX\d+$/);

    // Seats are not held until payment succeeds
    expect((await api.getTour('T100')).seats).toBe(seatsBefore);

    const paid = await api.pay(booking.ref, CARDS.ok);
    await expectStatus(paid, 200);
    expect((await paid.json()).status).toBe('CONFIRMED');
    expect((await api.getTour('T100')).seats).toBe(seatsBefore - 2);

    const cancelled = await api.cancel(booking.ref, '2027-01-01');
    await expectStatus(cancelled, 200);
    expect((await cancelled.json()).status).toBe('CANCELLED');

    // Cancelled seats go back to inventory
    expect((await api.getTour('T100')).seats).toBe(seatsBefore);

    // GET reflects the final state
    const fetched = await (await api.getBooking(booking.ref)).json();
    expect(fetched.status).toBe('CANCELLED');
  });

  test('declined card does not confirm the booking or take seats', async ({ api }) => {
    const seatsBefore = (await api.getTour('T200')).seats;
    const { ref } = await (await api.createBooking({ tourId: 'T200', travellers: 1, ...defaultGuest })).json();

    const res = await api.pay(ref, CARDS.declined);
    await expectStatus(res, 402);
    const body = await res.json();
    expect(body.error).toBe('Card declined');
    expect(body.booking.status).toBe('PAYMENT_FAILED');
    expect((await api.getTour('T200')).seats).toBe(seatsBefore);
  });

  test('a booking cannot be charged twice', async ({ api }) => {
    const booking = await api.confirmedBooking('T100');
    const secondCharge = await api.pay(booking.ref, CARDS.ok);
    await expectStatus(secondCharge, 409);
  });

  test('a booking cannot be cancelled twice (no double refund)', async ({ api }) => {
    const booking = await api.confirmedBooking('T100');
    await expectStatus(await api.cancel(booking.ref, '2027-01-01'), 200);
    await expectStatus(await api.cancel(booking.ref, '2027-01-01'), 409);
  });

  test('an unpaid booking cannot be cancelled for a refund', async ({ api }) => {
    const { ref } = await (await api.createBooking({ tourId: 'T100', travellers: 1, ...defaultGuest })).json();
    await expectStatus(await api.cancel(ref), 409);
  });

  test('the last seats cannot be sold twice', async ({ api }) => {
    // T300 has 2 seats. Two customers start checkout for both seats at the same time.
    const a = await (await api.createBooking({ tourId: 'T300', travellers: 2, ...defaultGuest })).json();
    const b = await (await api.createBooking({ tourId: 'T300', travellers: 2, guestName: 'Sara Ali', email: 'sara@example.com' })).json();

    await expectStatus(await api.pay(a.ref), 200);
    // Second payment must be rejected, otherwise the tour is oversold
    await expectStatus(await api.pay(b.ref), 409);
    expect((await api.getTour('T300')).seats).toBe(0);
  });
});
