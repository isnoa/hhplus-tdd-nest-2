# 콘서트 예약 시스템

---

## 개요

콘서트 예약/결제 서비스입니다. 주요 기능:

- 좌석 예약
- 포인트 결제
- 대기열 토큰
- 포인트 충전

---

## 아키텍처

디렉토리:

```
src/
├── payment/             # 클린
├── reservation/         # 레이어드
├── user/
├── queue/
├── concert/
└── common/
```

---

```bash
npm install
# .env 설정
npm run typeorm migration:run
npm run start:dev
```

### 테스트 실행

```bash
# 모든 단위 테스트
npm run test

# Mock 활용 테스트
npm run test -- process-payment.use-case.spec.ts

# 커버리지 리포트
npm run test:cov
```

---

### Swagger/OpenAPI

http://localhost:3000/api-docs
