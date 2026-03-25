# Performance Benchmark Strategy

성능 회귀 방지 시스템.

## 철학

모든 변경이 성능 벤치마크를 필요로 하는 것은 아닙니다.
성능 측정은 **baseline이 존재할 때만** 유의미하며, 최초 구현에서는 baseline을 **생성**하는 것이 목적입니다.

## Gate B7: Performance Check

### Baseline 생성 (첫 번째 실행)

프로젝트에 `.crucible/benchmark-baseline.json`이 없으면:

1. 현재 구현의 성능을 측정하여 baseline 생성
2. 결과를 PASS로 처리 (비교 대상 없음)
3. 다음 게이트 실행부터 이 baseline과 비교

### Regression 감지 (이후 실행)

baseline이 존재하면:

1. 동일 벤치마크 실행
2. baseline 대비 비교
3. 허용 범위 초과 시 FAIL

### 측정 항목 (프로젝트 타입별)

#### backend-api
```bash
# 응답 시간 (p50, p95, p99)
# 프로젝트에 벤치마크 스크립트가 있으면 사용, 없으면 기본 측정
curl -w "@curl-format.txt" -s http://localhost:8000/health

# 스타트업 시간
time python -c "from app.main import app"
```

#### web-app
```bash
# Lighthouse Core Web Vitals (crucible-browse 사용)
$B goto --url http://localhost:3000
# LCP, FID, CLS 측정

# 번들 사이즈
du -sh dist/ || du -sh build/
```

#### cli-tool
```bash
# 명령 실행 시간
hyperfine --warmup 3 './my-cli --help'

# 메모리 사용
/usr/bin/time -l ./my-cli process test-data.json
```

#### library
```bash
# 프로젝트의 벤치마크 스위트 실행
pytest benchmarks/ --benchmark-json=benchmark.json  # Python
vitest bench                                        # TypeScript
go test -bench=. ./...                              # Go
```

### Baseline 파일 형식

```json
{
  "version": "1.0",
  "created_at": "2026-03-23T12:00:00Z",
  "project_type": "backend-api",
  "measurements": {
    "startup_time_ms": 450,
    "response_time_p95_ms": 120,
    "memory_peak_mb": 85,
    "bundle_size_kb": null
  },
  "thresholds": {
    "startup_time_ms": { "max_regression_pct": 20 },
    "response_time_p95_ms": { "max_regression_pct": 15 },
    "memory_peak_mb": { "max_regression_pct": 25 }
  }
}
```

### 판정 기준

| 항목 | 허용 범위 | FAIL 조건 |
|------|---------|----------|
| 응답 시간 (p95) | baseline + 15% | > 15% 느림 |
| 스타트업 시간 | baseline + 20% | > 20% 느림 |
| 메모리 사용량 | baseline + 25% | > 25% 증가 |
| 번들 사이즈 | baseline + 10% | > 10% 증가 |

### 벤치마크가 불가능한 경우

다음 조건에서는 B7을 **SKIP** 처리합니다:
- 프로젝트에 실행 가능한 엔드포인트/CLI가 아직 없음
- 벤치마크 도구가 설치되지 않음
- 환경 차이로 안정적 측정이 불가

SKIP은 FAIL이 아니며, 게이트 통과에 영향을 주지 않습니다.
단, 보고서에 SKIP 사유를 명시합니다.
