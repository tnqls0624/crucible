# Worktree 병렬 실행 전략

## 언제 Worktree를 사용하는가

| 조건 | Worktree 사용 | Main에서 직접 실행 |
|------|:---:|:---:|
| 독립적 태스크 2개 이상 | O | |
| 태스크 간 의존성 있음 | | O |
| 같은 파일을 수정하는 태스크 | | O |
| 단일 태스크 | | O |

## Runtime Isolation Contract

Worktree 병렬 실행의 기본 단위는 `하나의 태스크 = 하나의 worktree = 하나의 에이전트 = 하나의 포트 블록` 입니다.

- 하나의 live worktree는 다른 live worktree와 포트 범위를 공유하지 않습니다.
- repo 공용 `.env`를 직접 수정하지 않고, worktree별 override 값으로 실행합니다.
- preview URL, 포트 범위, cleanup 상태는 runtime log에 기록합니다.
- evaluator가 검증한 preview URL과 runtime log의 preview URL은 동일해야 합니다.

포트 범위는 `.claude/settings.json`의 아래 환경 변수를 기준으로 계산합니다.

- `CRUCIBLE_WORKTREE_PORT_BASE`
- `CRUCIBLE_WORKTREE_PORT_BLOCK_SIZE`
- `CRUCIBLE_WORKTREE_PREVIEW_HOST`
- `CRUCIBLE_WORKTREE_RUNTIME_LOG`

tracked 기본값은 `auto`이며, 실제 preview host는 각 사용자/프로젝트가 shell env로 override 할 수 있습니다. override가 없으면 로컬 loopback 주소를 자동 사용합니다.

기본 계산식:

```text
slot_index = 0, 1, 2, ...
port_start = CRUCIBLE_WORKTREE_PORT_BASE + (slot_index * CRUCIBLE_WORKTREE_PORT_BLOCK_SIZE)
port_end   = port_start + CRUCIBLE_WORKTREE_PORT_BLOCK_SIZE - 1
```

기본 매핑 예시 (`BLOCK_SIZE=20`):

| 슬롯 | 포트 범위 | 권장 용도 |
|------|----------|-----------|
| 0 | 4100-4119 | frontend=4100, backend=4101, preview=4102, reserved=4103-4119 |
| 1 | 4120-4139 | frontend=4120, backend=4121, preview=4122, reserved=4123-4139 |
| 2 | 4140-4159 | frontend=4140, backend=4141, preview=4142, reserved=4143-4159 |

## Worktree 실행 패턴

```
main branch
  │
  ├── worktree/task-1 (engineer #1)
  │     └── [구현] → [리뷰] → [완료]
  │
  ├── worktree/task-2 (engineer #2)
  │     └── [구현] → [리뷰] → [완료]
  │
  └── merge task-1, task-2 → main
```

각 worktree는 아래 수명주기를 따릅니다.

```text
ALLOCATED → RUNNING → EVALUATING → READY_FOR_REVIEW → MERGED/CANCELLED → CLEANED
```

## Agent 호출 예시

```
Agent(
  description: "Task 1 구현",
  prompt: "...",
  isolation: "worktree",
  model: "sonnet"
)
```

## Runtime Log 기록 규칙

runtime 메타데이터는 `.claude/settings.json`의 `CRUCIBLE_WORKTREE_RUNTIME_LOG` 경로에 기록합니다.
기본 경로는 `.claude/runtime/worktree-runtime.md` 입니다.

각 active worktree는 최소 아래 항목을 남깁니다.

| 항목 | 설명 |
|------|------|
| Task ID | ADR의 canonical `Task ID` (`ADR002-T2` 형태) |
| Branch | worktree branch 이름 |
| Worktree Path | worktree 경로 |
| Port Range | 할당된 포트 범위 |
| Preview URL | evaluator와 reviewer가 확인할 URL |
| Status | `ALLOCATED`, `RUNNING`, `EVALUATING`, `READY_FOR_REVIEW`, `CLEANED` 중 하나 |
| Cleanup | `pending` 또는 `done` |

기록 예시:

```markdown
| Task ID | Branch | Worktree | Port Range | Preview URL | Status | Cleanup |
|---------|--------|----------|------------|-------------|--------|---------|
| ADR002-T2 | codex/task-2 | worktree/task-2 | 4120-4139 | <preview-url> | READY_FOR_REVIEW | pending |
```

실제 할당과 갱신은 아래 도구로 수행합니다.

```bash
bun .claude/tools/worktree/runtime_registry.ts allocate \
  --task-id ADR002-T2 \
  --branch codex/task-2 \
  --worktree worktree/task-2

bun .claude/tools/worktree/runtime_registry.ts update \
  --task-id ADR002-T2 \
  --status READY_FOR_REVIEW

bun .claude/tools/worktree/runtime_registry.ts release \
  --task-id ADR002-T2
```

## Env Override 규칙

- 공용 `.env` 파일을 직접 수정하지 않습니다.
- worktree 시작 시 shell env 또는 worktree 전용 env file로 포트를 주입합니다.
- 앱이 여러 프로세스를 띄우는 경우에도 같은 블록 안에서만 포트를 사용합니다.
- preview URL은 evaluator handoff와 runtime log에서 동일한 값을 사용합니다.
- 필요하면 `CRUCIBLE_WORKTREE_PREVIEW_HOST`를 shell env로 override 합니다.
- override가 없으면 runtime registry가 로컬 loopback preview URL을 자동 계산합니다.

예시:

```bash
CRUCIBLE_WORKTREE_PREVIEW_HOST=https://preview.example \
PORT=4120 API_PORT=4121 CRUCIBLE_PREVIEW_URL=https://preview.example:4120 npm run dev
```

## 충돌 해결

### Git 충돌

1. 자동 머지 시도 (`git merge --no-edit`)
2. 충돌 발생 시:
   - 충돌 파일 목록 출력
   - 사용자에게 수동 해결 요청 또는
   - engineer 에이전트에게 충돌 해결 위임

### 포트 충돌

1. runtime log에서 동일 포트 블록을 사용하는 live worktree가 있는지 확인
2. stale 상태면 실제 프로세스 존재 여부를 확인 후 블록 회수
3. live 프로세스가 남아 있으면 다음 free slot으로 재할당
4. 충돌 사실과 재할당 결과를 runtime log에 기록

### Preview 불일치

1. evaluator가 접근한 URL과 runtime log의 `Preview URL` 비교
2. 다르면 runtime log를 갱신하거나 evaluator를 재실행
3. reviewer는 불일치 상태에서 승인하지 않음

## Cleanup 규칙

- `READY_FOR_REVIEW` 전에는 worktree를 삭제하지 않습니다.
- `MERGED` 또는 `CANCELLED` 후에는 dev server를 중지하고 cleanup 상태를 `done`으로 기록합니다.
- 스크린샷, 로그, evidence 경로는 먼저 session log 또는 QA report에 남긴 뒤 worktree를 정리합니다.
- 정리 순서:
  1. 프로세스 종료
  2. runtime log 상태를 `CLEANED`로 변경
  3. cleanup 컬럼을 `done`으로 변경
  4. worktree 삭제

## Hook / Settings Touchpoints

- `.claude/settings.json`: 포트 base, block size, preview host, runtime log 경로를 정의합니다.
- `.claude/hooks/check-phase-permission.sh`: runtime log 같은 live registry는 build/gate 중에도 기록 가능해야 합니다.
- `.claude/tools/worktree/runtime_registry.ts`: 슬롯 할당, 상태 갱신, cleanup 완료를 기계적으로 처리합니다.
- `crucible-build`: evaluator/reviewer handoff에 `Preview URL`과 `Port Range`를 포함합니다.

## 주의사항

- Worktree당 하나의 에이전트만 할당
- 공유 설정 파일 (package.json, pyproject.toml) 수정은 순차 실행
- preview URL 없이 evaluator를 호출하지 않음
- runtime log 갱신 없이 포트 재할당하지 않음
- Worktree는 태스크 완료 후 자동 정리됨
