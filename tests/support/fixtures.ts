import { test as base } from '@playwright/test';
import { BookingApi } from './booking-api';
import { BookingPage } from './booking-page';

type Fixtures = {
  api: BookingApi;
  bookingPage: BookingPage;
};

export const test = base.extend<Fixtures>({
  // Every test starts from clean seed data, so tests never depend on each other.
  api: async ({ request }, use) => {
    const api = new BookingApi(request);
    await api.reset();
    await use(api);
  },
  bookingPage: async ({ page, api }, use) => {
    void api; // ensures the reset runs before the page is used
    await use(new BookingPage(page));
  },
});

export { expect } from '@playwright/test';
