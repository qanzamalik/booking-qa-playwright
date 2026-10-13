import { APIRequestContext, APIResponse, expect } from '@playwright/test';

export const CARDS = {
  ok: '4242424242424242',
  declined: '4000000000000002',
};

export const RATES = { commission: 0.12, tax: 0.05 };

export interface Booking {
  ref: string;
  tourId: string;
  travellers: number;
  status: 'PENDING_PAYMENT' | 'PAYMENT_FAILED' | 'CONFIRMED' | 'CANCELLED';
  baseCents: number;
  taxCents: number;
  totalCents: number;
  commissionCents: number;
  supplierPayoutCents: number;
  refundCents: number;
  refundPercent?: number;
}

export interface Tour {
  id: string;
  name: string;
  type: string;
  destination: string;
  departure: string;
  priceCents: number;
  seats: number;
}

export const defaultGuest = { guestName: 'Ayesha Khan', email: 'ayesha@example.com' };

/** Thin client around the booking API so specs read like test cases, not HTTP plumbing. */
export class BookingApi {
  constructor(private request: APIRequestContext) {}

  async reset() {
    const res = await this.request.post('/api/reset');
    expect(res.ok(), 'reset endpoint needs TEST_MODE=1').toBeTruthy();
  }

  searchTours(params: Record<string, string> = {}) {
    return this.request.get('/api/tours', { params });
  }

  async getTour(id: string): Promise<Tour> {
    const tours: Tour[] = await (await this.searchTours()).json();
    const tour = tours.find((t) => t.id === id);
    if (!tour) throw new Error(`Tour ${id} not found`);
    return tour;
  }

  createBooking(data: Record<string, unknown>) {
    return this.request.post('/api/bookings', { data });
  }

  getBooking(ref: string) {
    return this.request.get(`/api/bookings/${ref}`);
  }

  pay(ref: string, cardNumber = CARDS.ok, today?: string) {
    return this.request.post(`/api/bookings/${ref}/pay`, {
      data: { cardNumber },
      headers: today ? { 'x-test-now': today } : {},
    });
  }

  cancel(ref: string, today?: string) {
    return this.request.post(`/api/bookings/${ref}/cancel`, {
      headers: today ? { 'x-test-now': today } : {},
    });
  }

  /** Create + pay in one step, asserting each step succeeded. */
  async confirmedBooking(tourId: string, travellers = 1): Promise<Booking> {
    const created = await this.createBooking({ tourId, travellers, ...defaultGuest });
    await expectStatus(created, 201);
    const { ref } = await created.json();
    const paid = await this.pay(ref);
    await expectStatus(paid, 200);
    return paid.json();
  }
}

/** Status assertion that prints the response body on failure, which makes CI logs useful. */
export async function expectStatus(res: APIResponse, status: number) {
  expect(res.status(), `Unexpected status. Body: ${await res.text()}`).toBe(status);
}
