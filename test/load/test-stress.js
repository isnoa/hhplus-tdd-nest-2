import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate, Counter, Gauge } from "k6/metrics";

/*
 * Test Case 3: Stress Test (VU 300-1000)
 * 목표:
 *   - 시스템 한계점 파악
 *   - 우아한 성능 저하 (graceful degradation) 확인
 *   - 메모리 누수 여부 확인
 *   - 장애 복구 가능성 검증
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API_DURATION = new Trend("api_duration");
const API_ERRORS = new Rate("api_errors");
const API_SUCCESS = new Rate("api_success");
const REQUEST_TOTAL = new Counter("requests_total");
const CONCURRENT_USERS = new Gauge("concurrent_users");

export const options = {
  vus: 300,
  duration: "5m",
  rampUp: {
    stages: [
      { duration: "30s", target: 100 },
      { duration: "30s", target: 300 },
      { duration: "30s", target: 500 },
      { duration: "30s", target: 1000 },
      { duration: "2m", target: 1000 },
      { duration: "30s", target: 500 },
      { duration: "30s", target: 100 },
    ],
  },
  thresholds: {
    api_duration: ["p(50)<1000", "p(95)<3000"],
    api_errors: ["rate<0.1"],
    api_success: ["rate>0.9"],
  },
};

// 시스템 상태 모니터링
let requestInFlight = 0;
let peakConcurrency = 0;

export default function () {
  // VU 수 증가 시 Gauge 업데이트
  CONCURRENT_USERS.set(requestInFlight);
  if (requestInFlight > peakConcurrency) {
    peakConcurrency = requestInFlight;
  }

  // ========================================================================
  // Phase 1: 콘서트 조회 (읽기 위주)
  // ========================================================================
  group("Phase 1: High Concurrency Read", () => {
    requestInFlight++;

    const response = http.get(`${BASE_URL}/api/concerts?limit=20`);
    requestInFlight--;

    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);

    const isSuccess = response.status === 200;
    API_SUCCESS.add(isSuccess ? 1 : 0);
    API_ERRORS.add(!isSuccess ? 1 : 0);

    check(response, {
      "조회 성공": (r) => r.status === 200,
      "타임아웃 없음": (r) => r.timings.duration < 5000,
      "500 에러 없음": (r) => r.status !== 500,
    });
  });

  sleep(Math.random() * 2); // 0-2초 랜덤 대기

  // ========================================================================
  // Phase 2: 예약 생성 (쓰기 위주, CPU 집약적)
  // ========================================================================
  group("Phase 2: Stress Write Operations", () => {
    requestInFlight++;

    const userId = __VU;
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

    requestInFlight--;

    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);

    // 성공: 201, 좌석 충돌: 400, 동시성 문제: 409
    const isSuccess =
      response.status === 201 ||
      response.status === 400 ||
      response.status === 409;
    API_SUCCESS.add(isSuccess ? 1 : 0);
    API_ERRORS.add(!isSuccess ? 1 : 0);

    check(response, {
      "예약 생성/거절 처리됨": (r) =>
        r.status === 201 || r.status === 400 || r.status === 409,
      "응답 있음 (타임아웃 없음)": (r) => r.timings.duration < 10000,
      "서버 에러 없음": (r) => r.status !== 500 && r.status !== 503,
    });
  });

  sleep(Math.random() * 3); // 0-3초 랜덤 대기

  // ========================================================================
  // Phase 3: 랭킹 조회 (Redis 읽기)
  // ========================================================================
  group("Phase 3: Cache Read Under Stress", () => {
    requestInFlight++;

    const response = http.get(`${BASE_URL}/api/concerts/rankings/realtime`);

    requestInFlight--;

    REQUEST_TOTAL.add(1);
    API_DURATION.add(response.timings.duration);

    const isSuccess = response.status === 200;
    API_SUCCESS.add(isSuccess ? 1 : 0);
    API_ERRORS.add(!isSuccess ? 1 : 0);

    check(response, {
      "캐시 조회 성공": (r) => r.status === 200,
      "캐시는 빠름": (r) => r.timings.duration < 200 || r.status !== 200,
      "서비스 가능": (r) => r.status !== 503,
    });
  });

  sleep(0.5);
}

// 테스트 종료 시 피크 동시성 출력
export function teardown(data) {
  console.log(`Peak Concurrent Users: ${peakConcurrency}`);
}
