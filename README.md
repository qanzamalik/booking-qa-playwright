# Booking QA — Playwright + TypeScript

A Playwright test suite for a travel booking flow: **search → booking → payment → commission → cancellation → refund**.

It ships with a small demo booking app (`app/`) so the suite runs anywhere, including CI, without depending on a public demo site that can go down or change.

## What's covered

| Area | Spec | What it checks |
|---|---|---|
| Search | `tests/api/search.spec.ts` | Response contract, filters, case-insensitivity, empty results |
| Booking lifecycle | `tests/api/booking-lifecycle.spec.ts` | Status transitions, seat inventory, declined cards, double charge, double refund, overselling the last seats |
| Money | `tests/api/pricing-commission.spec.ts` | Tax, commission and supplier payout reconcile to the cent; refund policy boundaries (30 / 7 days) |
| Validation | `tests/api/validation.spec.ts` | Negative cases: bad traveller counts, invalid email, unknown tour, invalid card |
| UI flow | `tests/e2e/booking-flow.spec.ts` | End-to-end booking, UI total matches the backend, declined card, form errors, cancellation |

**Cross-browser and mobile:** UI tests run on Chromium, Firefox, WebKit, Pixel 7 and iPhone 14.

## Why the money tests matter

A booking can show **CONFIRMED** with a correct receipt while the commission or payout underneath is wrong. Status checks alone won't catch that.

To prove the suite catches it, set the commission to `0` in `app/server.js`:

```
5 failed  (all commission/payout cases)
32 passed (booking flow still "works")
```

The full write-up of that scenario is in [`docs/sample-bug-report.md`](docs/sample-bug-report.md).

## Run it

```bash
npm install
npx playwright install --with-deps

npm test               # everything
npm run test:api       # API only (fast, no browser)
npm run test:ui        # desktop Chrome
npm run test:mobile    # mobile Chrome + Safari
npm run report         # open the HTML report
```

**Against staging or production:**

```bash
BASE_URL=https://staging.example.com npx playwright test --project=chromium
```

(The reset endpoint used for test isolation only exists in `TEST_MODE`. On shared environments, tests should create their own data instead.)

## CI

`.github/workflows/playwright.yml` runs on every pull request, on `main`, daily, and on demand against any `BASE_URL`:

- TypeScript typecheck first
- One job per project (API + 5 browser/device targets), `fail-fast: false` so one browser failing doesn't hide the others
- HTML report, traces, screenshots and videos uploaded as artifacts on every run

## Design choices

- **Integer cents everywhere.** No floating-point money.
- **Page object + API client** (`tests/support/`) so specs read like test cases.
- **Fixtures reset state before each test.** No test depends on another.
- **Role and label locators** over CSS, so tests survive UI refactors.
- **Pinned test clock** (`x-test-now` header) makes refund-window tests deterministic.
- **Traces on failure** go straight into bug reports.

## How AI was used

The suite was drafted with Claude and reviewed, run and verified by hand. Every assertion was checked against the business rules, and the commission tests were validated by injecting a real bug to confirm they fail for the right reason. AI writes tests fast; the review step is what stops tests that pass for the wrong reason.
