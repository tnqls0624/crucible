---
name: crucible-ship
description: |
  릴리스 및 배포를 관리합니다. CHANGELOG 생성(Keep a Changelog), 시맨틱 버전 태깅, README 동기화, CI/CD 설정 확인, gate-ship 검증, PR 생성/머지를 수행합니다. Crucible 파이프라인의 마지막 단계이며, 완료 후 다음 피처 사이클(spec)로 리셋됩니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-ship` 명령을 사용할 때
  - "배포", "릴리스", "출시", "deploy", "release", "ship" 언급 시
  - "버전 태그", "version tag", "시맨틱 버전" 언급 시
  - "PR 만들어줘", "main에 머지", "pull request" 언급 시
  - "CHANGELOG 작성", "변경 이력", "릴리스 노트" 언급 시
  - 모든 품질 게이트를 통과한 코드를 릴리스할 때
  - CI/CD 파이프라인 설정이나 GitHub Actions 워크플로우 확인이 필요할 때

  Example triggers: "게이트 다 통과했으니까 릴리스하자. v1.2.0으로 태그 달아줘", "배포 준비해줘. CHANGELOG 업데이트하고 PR 만들어서 main에 머지하자"
---

# /crucible-ship — 릴리스 및 배포

품질 게이트를 통과한 코드를 프로덕션으로 보내는 마지막 단계입니다. CHANGELOG, 버전 태그, 문서 동기화를 자동화하고, 사용자의 명시적 승인 후에만 외부에 영향을 주는 작업(push, deploy)을 실행합니다.

## Prerequisites

- 현재 Phase가 `ship`
- gate-build 전체 PASS (최신 Gate Report 확인)

## Workflow

### Step 1: 릴리스 준비

3가지를 순서대로 확인합니다:

1. **CHANGELOG**: tech-writer 에이전트를 호출하여 Keep a Changelog 형식으로 업데이트
2. **README**: 주요 변경사항이 README에 반영되었는지 확인, 미반영 시 tech-writer로 업데이트
3. **CI/CD**: devops 에이전트를 호출하여 GitHub Actions/GitLab CI 설정 확인

### Step 2: 버전 결정

시맨틱 버전 규칙에 따라 사용자에게 버전을 제안합니다:

- **MAJOR** (v2.0.0): 하위 호환성이 깨지는 변경
- **MINOR** (v1.1.0): 새 기능 추가 (하위 호환 유지)
- **PATCH** (v1.0.1): 버그 수정

**Example:**
```
이번 변경은 새 API 엔드포인트 추가입니다.
기존 API에 영향 없으므로 MINOR 버전 업을 제안합니다: v1.1.0 → v1.2.0
이 버전이 맞나요?
```

### Step 3: gate-ship 검증

`.claude/gates/gate-ship.md`의 모든 조건을 확인합니다:
- gate-build 최신 통과 여부
- CHANGELOG 업데이트 여부
- README 동기화 여부
- 버전 태그 형식 (`v{major}.{minor}.{patch}`)

### Step 4: 릴리스 실행

**중요**: 이 단계는 외부에 영향을 주므로 사용자의 명시적 승인이 필요합니다. 승인 전에 수행할 작업 목록을 보여줍니다.

승인 후:
1. Git tag 생성 (`git tag v{x.y.z}`)
2. PR 생성 또는 main 머지 (사용자 선택)
3. 필요 시 배포 트리거

### Step 5: Canary 모니터링

배포 직후 서비스 안정성을 확인합니다.

1. **Health Check**: 배포된 서비스의 헬스 엔드포인트 확인
2. **Smoke Test**: 핵심 사용자 플로우 1-2개를 빠르게 실행
3. **Error Monitoring**: 배포 후 에러 로그/메트릭 관찰
4. **Rollback 판단**: 이상 감지 시 즉시 롤백 제안

```markdown
### Canary Check
| Check | Status | Details |
|-------|--------|---------|
| Health endpoint | OK | /health 200 OK, 45ms |
| Smoke test | OK | 핵심 플로우 정상 |
| Error rate | OK | 0 errors |
| Response time | OK | p95 120ms |
```

배포 환경이 로컬/스테이징인 경우 canary는 SKIP하고 보고서에 기록합니다.

### Step 6: Phase 리셋

- `CLAUDE.md`의 Phase를 `spec`으로 리셋 (다음 피처 사이클 준비)
- `.claude/CLAUDE.md`와 관련 스펙/ADR 문서 기준으로 shipped 상태를 정리

## Output Format

```markdown
## Crucible Ship Report

| 항목 | 값 |
|------|-----|
| Feature | {feature name} ({feature ID}) |
| Version | v0.1.0 |
| Gate | PASS |
| CHANGELOG | Updated |
| Tag | Created |

### 릴리스 완료
다음 피처 사이클을 시작하려면 `/crucible-spec`을 사용하세요.
```

> 실제 구현과 gate 통과가 선행된 뒤에만 ship을 실행합니다.

## Related Files

- **Gate**: `.claude/gates/gate-ship.md` — 릴리스 통과 조건
- **Agents**: `.claude/agents/devops.md`, `.claude/agents/tech-writer.md`
