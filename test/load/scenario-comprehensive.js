import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const api = __ENV.BASE_URL || "http://localhost:3000";
const duration = new Trend("duration");
const errors = new Rate("errors");
const count = new Counter("requests");

export const options = {
  vus: parseInt(__ENV.VU || "10"),
  duration: __ENV.DURATION || "5m",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.1"],
  },
};

const concerts = [1, 2, 3, 4, 5];
const schedules = [1, 2, 3, 4, 5];
const seats = Array.from({ length: 100 }, (_, i) => i + 1);

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function testReservation() {
  const payload = {
    concertId: rand(concerts),
    concertScheduleId: rand(schedules),
    seatId: rand(seats),
  };

  const res = http.post(`${api}/api/reservations`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });

  count.add(1);
  duration.add(res.timings.duration);
  errors.add(res.status !== 201 ? 1 : 0);

  check(res, {
    "201 Created": (r) => r.status === 201,
    "Response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}

export function testRanking() {
  const res = http.get(`${api}/api/concerts/rankings/realtime`);

  count.add(1);
  duration.add(res.timings.duration);
  errors.add(res.status !== 200 ? 1 : 0);

  check(res, {
    "200 OK": (r) => r.status === 200,
    "Response time < 100ms": (r) => r.timings.duration < 100,
  });

  sleep(0.5);
}

export function testBalance() {
  const userId = (__VU % 100) + 1;
  const res = http.get(`${api}/api/users/${userId}/balance`);

  count.add(1);
  duration.add(res.timings.duration);
  errors.add(res.status !== 200 ? 1 : 0);

  check(res, {
    "200 OK": (r) => r.status === 200,
  });

  sleep(0.5);
}

export default function () {
  testReservation();
  testRanking();
  testBalance();
}
