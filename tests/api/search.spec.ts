import { test, expect } from '../support/fixtures';
import { Tour } from '../support/booking-api';

test.describe('Search API', () => {
  test('returns all tours when no filter is applied', async ({ api }) => {
    const res = await api.searchTours();
    expect(res.ok()).toBeTruthy();
    const tours: Tour[] = await res.json();
    expect(tours.length).toBeGreaterThan(0);
    for (const t of tours) {
      // Contract check: every tour has the fields the UI and booking flow rely on
      expect(t).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        departure: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        priceCents: expect.any(Number),
        seats: expect.any(Number),
      });
      expect(Number.isInteger(t.priceCents), `${t.id} price must be integer cents`).toBeTruthy();
    }
  });

  test('filters by destination, case-insensitive', async ({ api }) => {
    const tours: Tour[] = await (await api.searchTours({ destination: 'bANFF' })).json();
    expect(tours.length).toBeGreaterThan(0);
    expect(tours.every((t) => t.destination === 'Banff')).toBeTruthy();
  });

  test('combines destination and type filters', async ({ api }) => {
    const tours: Tour[] = await (await api.searchTours({ destination: 'Banff', type: 'activity' })).json();
    expect(tours.map((t) => t.id)).toEqual(['T200']);
  });

  test('returns an empty list (not an error) for unknown destinations', async ({ api }) => {
    const res = await api.searchTours({ destination: 'Atlantis' });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
