import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

/*
 * Test Case 1: Normal Load (VU 50-100)
 * 목표:
 *   - 기본 성능 파악
 *   - 응답시간 p95 < 200ms
 *   - 에러율 < 0.1%
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_DURATION = new Trend("api_duration");
const API_ERRORS = new Rate("api_errors");
const REQUEST_TOTAL = new Counter("requests_total");

export const options = {
  vus: 50,
  duration: "5m",
  rampUp: {
    stages: [
      { duration: "1m", target: 10 },
      { duration: "2m", target: 50 },
      { duration: "1m", target: 10 },
    ],
  },
  thresholds: {
    api_duration: ["p(95)<200", "p(99)<500"],
    api_errors: ["rate<0.001"],
  },
};

export default function () {
  // 1. 콘서트 목록 조회
  group("Step 1: Get Concert List", () => {
    const response = http.get(`${BASE_URL}/api/concerts`);
    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);
    API_ERRORS.add(response.status !== 200 ? 1 : 0);

    check(response, {
      "concert list status is 200": (r) => r.status === 200,
      "response time < 200ms": (r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  // 2. 특정 콘서트 상세 조회
  group("Step 2: Get Concert Detail", () => {
    const concertId = Math.floor(Math.random() * 5) + 1;
    const response = http.get(`${BASE_URL}/api/concerts/${concertId}`);
    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);
    API_ERRORS.add(response.status !== 200 ? 1 : 0);

    check(response, {
      "concert detail status is 200": (r) => r.status === 200,
      "response time < 200ms": (r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  // 3. 인기도 랭킹 조회
  group("Step 3: Get Rankings", () => {
    const response = http.get(`${BASE_URL}/api/concerts/rankings/realtime`);
    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);
    API_ERRORS.add(response.status !== 200 ? 1 : 0);

    check(response, {
      "rankings status is 200": (r) => r.status === 200,
      "response time < 100ms": (r) => r.timings.duration < 100,
    });
  });

  sleep(1);

  // 4. 예약 생성
  group("Step 4: Create Reservation", () => {
    const userId = Math.floor(Math.random() * 100) + 1;
    const concertId = Math.floor(Math.random() * 5) + 1;
    const seatId = Math.floor(Math.random() * 100) + 1;

    const payload = {
      concertId: concertId,
      concertScheduleId: 1,
      seatId: seatId,
    };

    const headers = {
      "Content-Type": "application/json",
      "X-User-ID": userId.toString(),
    };

    const response = http.post(
      `${BASE_URL}/api/reservations`,
      JSON.stringify(payload),
      { headers },
    );
    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);
    API_ERRORS.add(response.status !== 201 ? 1 : 0);

    check(response, {
      "reservation created": (r) => r.status === 201,
      "response time < 500ms": (r) => r.timings.duration < 500,
    });
  });

  sleep(2);
}
