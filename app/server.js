// Mini tour-booking app used as the system under test.
// Zero dependencies: run with `node app/server.js`.
// All money is stored in integer cents to avoid floating-point rounding errors.

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 4321);
const TEST_MODE = process.env.TEST_MODE === '1';

const COMMISSION_RATE = 0.12; // platform commission on the base price
const TAX_RATE = 0.05; // tax charged to the customer on the base price

const SEED_TOURS = [
  { id: 'T100', name: 'Alaska Inside Passage Cruise', type: 'cruise', destination: 'Alaska', departure: '2027-06-10', nights: 7, priceCents: 189900, seats: 10 },
  { id: 'T200', name: 'Banff Lakes Day Trip', type: 'activity', destination: 'Banff', departure: '2027-03-15', nights: 0, priceCents: 14950, seats: 4 },
  { id: 'T300', name: 'Rockies Explorer 5-Day Tour', type: 'tour', destination: 'Banff', departure: '2027-05-01', nights: 5, priceCents: 124999, seats: 2 },
  { id: 'T400', name: 'Mediterranean Highlights Cruise', type: 'cruise', destination: 'Barcelona', departure: '2027-09-20', nights: 10, priceCents: 259900, seats: 20 },
];

let tours;
let bookings;
let refCounter;

function reset() {
  tours = SEED_TOURS.map((t) => ({ ...t }));
  bookings = new Map();
  refCounter = 1000;
}
reset();

// ---------- pricing ----------
function priceBooking(tour, travellers) {
  const baseCents = tour.priceCents * travellers;
  const taxCents = Math.round(baseCents * TAX_RATE);
  const commissionCents = Math.round(baseCents * COMMISSION_RATE);
  return {
    baseCents,
    taxCents,
    totalCents: baseCents + taxCents,
    commissionCents,
    supplierPayoutCents: baseCents - commissionCents,
  };
}

// Refund policy based on days before departure:
// 30+ days → 100% of total, 7–29 days → 50%, under 7 days → 0%.
function refundPercent(daysBefore) {
  if (daysBefore >= 30) return 100;
  if (daysBefore >= 7) return 50;
  return 0;
}

function daysBetween(fromIso, toIso) {
  const ms = new Date(toIso + 'T00:00:00Z') - new Date(fromIso + 'T00:00:00Z');
  return Math.floor(ms / 86400000);
}

function today(req) {
  // In test mode the clock can be pinned so refund-window tests are deterministic.
  if (TEST_MODE && req.headers['x-test-now']) return req.headers['x-test-now'];
  return new Date().toISOString().slice(0, 10);
}

// ---------- helpers ----------
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve(null); }
    });
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Test cards (same convention as most payment sandboxes)
const CARD_OK = '4242424242424242';
const CARD_DECLINED = '4000000000000002';

// ---------- routes ----------
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  if (req.method === 'POST' && url.pathname === '/api/reset' && TEST_MODE) {
    reset();
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/tours') {
    const dest = (url.searchParams.get('destination') || '').trim().toLowerCase();
    const type = (url.searchParams.get('type') || '').trim().toLowerCase();
    const result = tours.filter(
      (t) => (!dest || t.destination.toLowerCase().includes(dest)) && (!type || t.type === type),
    );
    return send(res, 200, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    const body = await readJson(req);
    if (!body) return send(res, 400, { error: 'Invalid JSON' });
    const { tourId, travellers, guestName, email } = body;
    const tour = tours.find((t) => t.id === tourId);
    if (!tour) return send(res, 404, { error: 'Tour not found' });
    if (!Number.isInteger(travellers) || travellers < 1 || travellers > 9) {
      return send(res, 400, { error: 'Travellers must be a whole number between 1 and 9' });
    }
    if (!guestName || !String(guestName).trim()) return send(res, 400, { error: 'Guest name is required' });
    if (!email || !EMAIL_RE.test(email)) return send(res, 400, { error: 'A valid email is required' });
    if (travellers > tour.seats) return send(res, 409, { error: `Only ${tour.seats} seats left` });

    const ref = 'RX' + ++refCounter;
    const booking = {
      ref,
      tourId,
      tourName: tour.name,
      departure: tour.departure,
      travellers,
      guestName: String(guestName).trim(),
      email,
      status: 'PENDING_PAYMENT',
      ...priceBooking(tour, travellers),
      refundCents: 0,
    };
    bookings.set(ref, booking);
    return send(res, 201, booking);
  }

  if (parts[0] === 'api' && parts[1] === 'bookings' && parts[2]) {
    const booking = bookings.get(parts[2]);
    if (!booking) return send(res, 404, { error: 'Booking not found' });

    if (req.method === 'GET' && parts.length === 3) return send(res, 200, booking);

    if (req.method === 'POST' && parts[3] === 'pay') {
      const body = (await readJson(req)) || {};
      if (booking.status !== 'PENDING_PAYMENT') {
        return send(res, 409, { error: `Booking is ${booking.status}, cannot pay` });
      }
      const card = String(body.cardNumber || '').replace(/\s/g, '');
      if (card === CARD_DECLINED) {
        booking.status = 'PAYMENT_FAILED';
        return send(res, 402, { error: 'Card declined', booking });
      }
      if (card !== CARD_OK) return send(res, 400, { error: 'Invalid card number' });
      const tour = tours.find((t) => t.id === booking.tourId);
      if (booking.travellers > tour.seats) return send(res, 409, { error: `Only ${tour.seats} seats left` });
      tour.seats -= booking.travellers; // seats are only held once payment succeeds
      booking.status = 'CONFIRMED';
      booking.paidAt = today(req);
      return send(res, 200, booking);
    }

    if (req.method === 'POST' && parts[3] === 'cancel') {
      if (booking.status !== 'CONFIRMED') {
        return send(res, 409, { error: `Booking is ${booking.status}, cannot cancel` });
      }
      const daysBefore = daysBetween(today(req), booking.departure);
      const pct = refundPercent(daysBefore);
      booking.refundCents = Math.round((booking.totalCents * pct) / 100);
      booking.refundPercent = pct;
      booking.status = 'CANCELLED';
      const tour = tours.find((t) => t.id === booking.tourId);
      tour.seats += booking.travellers; // release seats back to inventory
      return send(res, 200, booking);
    }
  }

  return send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (url.pathname === '/health') return send(res, 200, { status: 'ok' });
  // Single-page UI
  res.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
});

server.listen(PORT, () => console.log(`Booking app running on http://localhost:${PORT}`));
