import { Locator, Page, expect } from '@playwright/test';

/** Page object for the booking flow. Locators prefer roles and labels over CSS. */
export class BookingPage {
  readonly destination: Locator;
  readonly type: Locator;
  readonly searchButton: Locator;
  readonly tourCards: Locator;
  readonly noResults: Locator;
  readonly guestName: Locator;
  readonly email: Locator;
  readonly travellers: Locator;
  readonly continueButton: Locator;
  readonly bookingError: Locator;
  readonly card: Locator;
  readonly payButton: Locator;
  readonly paymentError: Locator;
  readonly total: Locator;
  readonly base: Locator;
  readonly tax: Locator;
  readonly bookingRef: Locator;
  readonly bookingStatus: Locator;
  readonly cancelButton: Locator;
  readonly refundInfo: Locator;

  constructor(readonly page: Page) {
    this.destination = page.getByLabel('Destination');
    this.type = page.getByLabel('Type');
    this.searchButton = page.getByRole('button', { name: 'Search' });
    this.tourCards = page.getByTestId('tour-card');
    this.noResults = page.getByTestId('no-results');
    this.guestName = page.getByLabel('Full name');
    this.email = page.getByLabel('Email');
    this.travellers = page.getByLabel('Travellers');
    this.continueButton = page.getByRole('button', { name: 'Continue to payment' });
    this.bookingError = page.locator('#booking-error');
    this.card = page.getByLabel('Card number');
    this.payButton = page.getByRole('button', { name: 'Pay now' });
    this.paymentError = page.locator('#payment-error');
    this.total = page.getByTestId('total');
    this.base = page.getByTestId('base');
    this.tax = page.getByTestId('tax');
    this.bookingRef = page.locator('#booking-ref');
    this.bookingStatus = page.locator('#booking-status');
    this.cancelButton = page.getByRole('button', { name: 'Cancel booking' });
    this.refundInfo = page.locator('#refund-info');
  }

  async open() {
    await this.page.goto('/');
  }

  async search(destination: string, type = '') {
    await this.destination.fill(destination);
    if (type) await this.type.selectOption(type);
    await this.searchButton.click();
  }

  async selectTour(tourId: string) {
    const card = this.page.locator(`[data-tour-id="${tourId}"]`);
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Select' }).click();
  }

  async fillGuest(name: string, email: string, travellers: number) {
    await this.guestName.fill(name);
    await this.email.fill(email);
    await this.travellers.fill(String(travellers));
    await this.continueButton.click();
  }

  async pay(cardNumber: string) {
    await this.card.fill(cardNumber);
    await this.payButton.click();
  }
}
