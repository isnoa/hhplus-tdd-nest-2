import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

/*
 * Test Case 2: High Load (VU 100-300)
 * 목표:
 *   - 높은 동시성 테스트
 *   - 응답시간 p95 < 500ms
 *   - 에러율 < 1%
 *   - CPU 사용률 50-70% 범위 내 유지
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_DURATION = new Trend("api_duration");
const API_ERRORS = new Rate("api_errors");
const RESERVATION_DURATION = new Trend("reservation_duration");
const REQUEST_TOTAL = new Counter("requests_total");

export const options = {
  vus: 100,
  duration: "10m",
  rampUp: {
    stages: [
      { duration: "1m", target: 50 },
      { duration: "2m", target: 100 },
      { duration: "2m", target: 200 },
      { duration: "2m", target: 300 },
      { duration: "2m", target: 100 },
      { duration: "1m", target: 10 },
    ],
  },
  thresholds: {
    api_duration: ["p(95)<500", "p(99)<1000"],
    api_errors: ["rate<0.01"],
    reservation_duration: ["p(95)<1000"],
  },
};

export default function () {
  // 1. 콘서트 목록 + 랭킹 (빠른 조회)
  group("Browser Phase 1: View Content", () => {
    const concertResponse = http.get(`${BASE_URL}/api/concerts?limit=20`);
    REQUEST_TOTAL.add(1);
    API_DURATION.add(concertResponse.timings.duration);
    API_ERRORS.add(concertResponse.status !== 200 ? 1 : 0);

    check(concertResponse, {
      "concerts loaded": (r) => r.status === 200,
      "timely response": (r) => r.timings.duration < 200,
    });
  });

  sleep(0.5);

  // 2. 인기도 랭킹 자주 조회 (사용자가 새로고침)
  group("Browser Phase 2: Check Rankings", () => {
    for (let i = 0; i < 3; i++) {
      const rankingResponse = http.get(
        `${BASE_URL}/api/concerts/rankings/realtime`,
      );
      REQUEST_TOTAL.add(1);
      API_DURATION.add(rankingResponse.timings.duration);
      API_ERRORS.add(rankingResponse.status !== 200 ? 1 : 0);

      check(rankingResponse, {
        "rankings available": (r) => r.status === 200,
        "fast ranking response": (r) => r.timings.duration < 150,
      });

      sleep(0.3);
    }
  });

  // 3. 예약 시도 (CPU 집약적)
  group("Browser Phase 3: Create Reservation", () => {
    const userId = __VU; // VU별로 유니크한 사용자ID
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
    RESERVATION_DURATION.add(response.timings.duration);
    API_ERRORS.add(response.status !== 201 && response.status !== 400 ? 1 : 0);

    check(response, {
      "reservation accepted or conflict": (r) =>
        r.status === 201 || r.status === 400 || r.status === 409,
      "timely response": (r) => r.timings.duration < 1000,
    });
  });

  sleep(1);

  // 4. 사용자 정보 조회 (가벼운 작업)
  group("Browser Phase 4: Check Balance", () => {
    const userId = __VU;
    const response = http.get(`${BASE_URL}/api/users/${userId}/balance`, {
      headers: {
        "X-User-ID": userId.toString(),
      },
    });

    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);
    API_ERRORS.add(response.status !== 200 ? 1 : 0);

    check(response, {
      "balance retrieved": (r) => r.status === 200,
      "quick response": (r) => r.timings.duration < 100,
    });
  });

  sleep(1);
}
