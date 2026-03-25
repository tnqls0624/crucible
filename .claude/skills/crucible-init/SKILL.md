---
name: crucible-init
description: |
  Crucible 프로젝트 부트스트랩. .claude/ 디렉토리 구조, CLAUDE.md, settings.json hooks, gates, agents, skills를 한 번에 세팅합니다. 이 스킬은 Crucible 파이프라인(spec→plan→build→gate→ship)의 진입점이며, 초기화 없이는 다른 crucible-* 스킬을 사용할 수 없습니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-init` 명령을 사용할 때
  - "새 프로젝트", "프로젝트 시작", "프로젝트 세팅", "초기화", "setup", "bootstrap" 언급 시
  - "Crucible로 관리", "Crucible 도입", "Crucible 설정", "파이프라인 설정" 언급 시
  - "개발환경 구성", "프로젝트 구성", "CLAUDE.md 설정" 언급 시
  - 빈 디렉토리에서 처음 작업을 시작할 때
  - 기존 프로젝트에 Crucible 프레임워크를 도입하려 할 때
  - Python/TypeScript/Go/Rust 프로젝트의 린터, 타입체커, 테스트 러너 초기 설정이 필요할 때

  Example triggers: "Claude-first pack compiler 프로젝트를 시작할 거야. 기본 세팅부터 해줘", "이 프로젝트에 Crucible 파이프라인을 도입하고 싶어", "새 프로젝트 초기화 해줘"
---

# /crucible-init — 프로젝트 부트스트랩

Crucible의 5단계 파이프라인(spec → plan → build → gate → ship)을 사용하려면 먼저 프로젝트를 초기화해야 합니다. 이 스킬은 필요한 디렉토리, 설정 파일, 게이트 정의를 한 번에 세팅합니다.

## Workflow

### Step 1: 프로젝트 정보 수집

사용자에게 4가지를 확인합니다. 대화에서 이미 언급된 정보는 재질문하지 않습니다.

1. **프로젝트 이름** — 영문 kebab-case 권장 (예: `claude-pack-compiler`)
2. **프로젝트 유형** — `web-app` | `backend-api` | `ai-agent` | `cli-tool` | `library`
3. **기술 스택** — 주 언어 + 프레임워크 (예: `Markdown-first spec + Bash hooks`)
4. **문제 정의** — 이 프로젝트가 해결하려는 핵심 문제 (1-3문장)

사용자가 한 번에 모든 정보를 주면 바로 Step 2로 넘어갑니다. 최소한의 질문으로 빠르게 진행하는 것이 좋습니다 — 초기화는 빨라야 합니다.

### Step 2: 디렉토리 구조 생성

기존 `.claude/` 구조를 확인하고 누락된 것만 생성합니다. 이미 있는 파일은 덮어쓰지 않습니다.

```
.claude/
├── agents/              # 에이전트 팀 정의
├── skills/              # 파이프라인 스킬
├── hooks/               # 결정론적 게이트 스크립트
├── memory/
│   ├── decisions/       # ADR 저장소
│   ├── specs/           # 피처 사양
│   └── session-log/     # 세션 복구용 로그
├── gates/               # 단계별 통과 조건
└── protocols/           # MCP + 도구 정책
```

### Step 3: 설정 파일 업데이트

3가지 파일을 수집된 정보로 채웁니다:

1. **`.claude/CLAUDE.md`** — Project Identity 섹션 (Name, Type, Stack, Phase=spec)
2. **`.claude/CLAUDE.md`** — Project Identity, 현재 Phase, 핵심 운영 규칙
3. **`.claude/settings.json`** — env 섹션의 `CRUCIBLE_PROJECT_NAME`, `CRUCIBLE_PROJECT_TYPE`, `CRUCIBLE_STACK`, `CRUCIBLE_PHASE=spec`

### Step 4: 스택별 게이트 커맨드 조정

프로젝트 스택에 따라 `.claude/gates/gate-build.md`의 검증 커맨드가 달라져야 합니다. 올바른 도구를 설정해야 나중에 `/crucible-gate`가 제대로 동작합니다.

| Stack | Type Check | Linter | Test Runner |
|-------|-----------|--------|-------------|
| Python | `pyright` | `ruff check` | `pytest` |
| TypeScript | `tsc --noEmit` | `eslint` | `vitest` / `jest` |
| Go | `go vet` | `golangci-lint run` | `go test ./...` |
| Rust | `cargo check` | `cargo clippy` | `cargo test` |

### Step 5: Git 확인

`.git`이 없으면 사용자에게 `git init` 여부를 묻습니다. 이미 git repo라면 스킵합니다. Crucible은 worktree 기반 병렬 실행을 지원하므로 git이 있는 편이 좋습니다.

### Step 6: 초기화 보고

완료 후 간결한 보고서를 출력합니다:

**Example:**
```
## Crucible 초기화 완료

| 항목 | 값 |
|------|-----|
| 프로젝트 | claude-pack-compiler |
| 유형 | ai-agent |
| 스택 | Markdown-first spec + Bash hooks |
| 단계 | spec |

### 다음 단계
`/crucible-spec` 으로 첫 번째 피처 사양을 작성하세요.
```

## Edge Cases

- **기존 CLAUDE.md가 Crucible 형식이 아닌 경우**: 백업(`CLAUDE.md.bak`)을 만든 후 Crucible 형식으로 마이그레이션을 제안합니다. 사용자의 기존 규칙은 보존합니다.
- **디렉토리 권한 문제**: 에러 메시지를 그대로 보여주고 수동 생성 방법을 안내합니다.
- **settings.json 파싱 실패**: 기존 파일을 백업한 후 새로 생성합니다.
