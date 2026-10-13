import { test, expect } from '../support/fixtures';
import { CARDS } from '../support/booking-api';

test.describe('Booking flow (UI)', () => {
  test.beforeEach(async ({ bookingPage }) => {
    await bookingPage.open();
  });

  test('search → book → pay → confirmation, and the UI total matches the API', async ({ bookingPage, api, page }) => {
    await bookingPage.search('Banff', 'activity');
    await expect(bookingPage.tourCards).toHaveCount(1);
    await bookingPage.selectTour('T200');

    await bookingPage.fillGuest('Ayesha Khan', 'ayesha@example.com', 2);

    // $149.50 × 2 = $299.00 base, 5% tax = $14.95, total $313.95
    await expect(bookingPage.base).toHaveText('$299.00');
    await expect(bookingPage.tax).toHaveText('$14.95');
    await expect(bookingPage.total).toHaveText('$313.95');

    await bookingPage.pay(CARDS.ok);
    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible();
    await expect(bookingPage.bookingStatus).toHaveText('CONFIRMED');

    // Cross-check: the amount shown to the customer is what the backend charged
    const ref = (await bookingPage.bookingRef.textContent())!;
    const booking = await (await api.getBooking(ref)).json();
    expect(booking.totalCents).toBe(31395);
  });

  test('declined card shows an error and does not confirm the booking', async ({ bookingPage, page }) => {
    await bookingPage.search('Alaska');
    await bookingPage.selectTour('T100');
    await bookingPage.fillGuest('Ayesha Khan', 'ayesha@example.com', 1);
    await bookingPage.pay(CARDS.declined);

    await expect(bookingPage.paymentError).toHaveText('Card declined');
    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeHidden();
  });

  test('form validation errors are shown to the user', async ({ bookingPage }) => {
    await bookingPage.search('Alaska');
    await bookingPage.selectTour('T100');
    await bookingPage.fillGuest('Ayesha Khan', 'not-an-email', 1);
    await expect(bookingPage.bookingError).toHaveText('A valid email is required');
    await expect(bookingPage.payButton).toBeHidden();
  });

  test('empty search shows a helpful message', async ({ bookingPage }) => {
    await bookingPage.search('Atlantis');
    await expect(bookingPage.noResults).toBeVisible();
    await expect(bookingPage.tourCards).toHaveCount(0);
  });

  test('customer can cancel a confirmed booking and sees the refund', async ({ bookingPage }) => {
    await bookingPage.search('Barcelona');
    await bookingPage.selectTour('T400');
    await bookingPage.fillGuest('Ayesha Khan', 'ayesha@example.com', 1);
    await bookingPage.pay(CARDS.ok);

    await bookingPage.cancelButton.click();
    await expect(bookingPage.bookingStatus).toHaveText('CANCELLED');
    await expect(bookingPage.refundInfo).toHaveText(/^Refund: \$[\d.]+ \(\d+%\)$/);
    await expect(bookingPage.cancelButton).toBeDisabled();
  });
});
