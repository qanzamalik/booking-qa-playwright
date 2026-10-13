import { test, expect } from '../support/fixtures';
import { defaultGuest, expectStatus } from '../support/booking-api';

test.describe('Booking validation (negative cases)', () => {
  const invalid = [
    { name: 'zero travellers', data: { tourId: 'T100', travellers: 0, ...defaultGuest }, status: 400 },
    { name: 'negative travellers', data: { tourId: 'T100', travellers: -2, ...defaultGuest }, status: 400 },
    { name: 'decimal travellers', data: { tourId: 'T100', travellers: 1.5, ...defaultGuest }, status: 400 },
    { name: 'travellers as string', data: { tourId: 'T100', travellers: '2', ...defaultGuest }, status: 400 },
    { name: 'more than 9 travellers', data: { tourId: 'T400', travellers: 10, ...defaultGuest }, status: 400 },
    { name: 'blank guest name', data: { tourId: 'T100', travellers: 1, guestName: '   ', email: 'a@b.co' }, status: 400 },
    { name: 'invalid email', data: { tourId: 'T100', travellers: 1, guestName: 'Ali', email: 'ali@' }, status: 400 },
    { name: 'unknown tour', data: { tourId: 'NOPE', travellers: 1, ...defaultGuest }, status: 404 },
    { name: 'more travellers than seats left', data: { tourId: 'T300', travellers: 3, ...defaultGuest }, status: 409 },
  ];

  for (const { name, data, status } of invalid) {
    test(`rejects ${name}`, async ({ api }) => {
      const res = await api.createBooking(data);
      await expectStatus(res, status);
      expect((await res.json()).error).toBeTruthy();
    });
  }

  test('rejects an invalid card number without changing the booking', async ({ api }) => {
    const { ref } = await (await api.createBooking({ tourId: 'T100', travellers: 1, ...defaultGuest })).json();
    await expectStatus(await api.pay(ref, '1234'), 400);
    expect((await (await api.getBooking(ref)).json()).status).toBe('PENDING_PAYMENT');
  });

  test('returns 404 for an unknown booking reference', async ({ api }) => {
    await expectStatus(await api.getBooking('RX0000'), 404);
  });
});
