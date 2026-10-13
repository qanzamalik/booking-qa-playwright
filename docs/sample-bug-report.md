# Sample bug report

This is the format I use for bug reports. The example below was produced by deliberately
breaking the commission calculation in this repo (`commissionCents = 0`) and letting the suite catch it.

---

**Title:** Platform commission is $0 on paid bookings — booking still shows CONFIRMED

**Severity:** Critical (revenue loss on every booking, no visible error)
**Environment:** staging · build `abc123` · API
**Found by:** `tests/api/pricing-commission.spec.ts` (5/5 cases failed)

**Steps to reproduce**
1. `POST /api/bookings` with `{ "tourId": "T100", "travellers": 1, ... }`
2. `POST /api/bookings/{ref}/pay` with test card `4242 4242 4242 4242`
3. `GET /api/bookings/{ref}`

**Expected**
- `status`: `CONFIRMED`
- `commissionCents`: `22788` (12% of base `189900`)
- `supplierPayoutCents + commissionCents == baseCents`

**Actual**
- `status`: `CONFIRMED` ✅
- `commissionCents`: `0` ❌
- `supplierPayoutCents`: `189900` — supplier is paid the full base price

**Why this is easy to miss**
Every status check passes: the booking is confirmed, the customer is charged the correct total,
and the confirmation page looks normal. Only the money split is wrong.

**Evidence**
- Playwright trace: `test-results/.../trace.zip` (open with `npx playwright show-trace`)
- Failing assertion: `expect(booking.commissionCents).toBeGreaterThan(0)`

**Suggested regression scope after the fix**
- Commission across travellers 1–9, odd-cent prices, and the largest booking amount
- Refund amounts after cancellation (refund is based on total, commission must not be refunded twice)
- Supplier payout report totals for the same date range
