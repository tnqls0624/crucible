# Crucible

Crucible is a repo-local AI engineering workflow for `Claude Code` and `Codex`.
It gives you a repeatable pipeline instead of a blank prompt:

**spec → plan → build → gate → ship**

The goal is simple: use structured agent roles and phase gates to move real project code
from idea to implementation, validation, and release with less drift and less rework.

## Who This Is For

- 혼자 빠르게 제품을 만드는 개발자
- 작은 팀에서 AI 코딩 워크플로우를 공통 규칙으로 맞추고 싶은 사람
- Claude Code / Codex를 쓰지만 아직 항상 같은 품질로 작업이 굴러가지 않는 사람

## Quick Start

Prerequisite: `bun`이 설치되어 있어야 합니다. Crucible의 repo-local validator/registry 도구와 optional browser tool이 모두 Bun을 사용합니다.

별도 로컬 설정이 없어도 `./setup` 후 바로 사용할 수 있습니다. worktree preview URL은 기본적으로 로컬 loopback 주소로 자동 계산되고, 필요할 때만 `CRUCIBLE_WORKTREE_PREVIEW_HOST`를 env로 override 하면 됩니다.

1. 저장소를 clone 합니다.
2. host에 맞게 setup을 실행합니다.
3. `/crucible-status`로 현재 상태를 보고, 새 작업이면 `/crucible-spec`부터 시작합니다.

```bash
git clone https://github.com/tnqls0624/crucible.git
cd crucible

./setup --host claude
# 또는
./setup --host codex
```

설치 후 일반 사용자는 `.claude` 문서를 직접 수정하지 않습니다.
대부분의 경우 바로 프로젝트 코드 작업으로 들어갑니다.

## Install

### Claude Code

```bash
./setup --host claude
```

- `.claude/hooks/` 실행 권한을 정리합니다.
- 현재 저장소에서 Crucible 워크플로우를 바로 사용할 수 있게 준비합니다.

### Codex

```bash
./setup --host codex
```

- `.claude` source를 바탕으로 repo-local `.agents/` 산출물을 생성합니다.
- Codex는 root `AGENTS.md`와 generated `.agents/`를 함께 읽습니다.
- `.claude/agent-manifest.yaml`이 있으면 setup이 먼저 validator를 실행해 fail-closed로 검증합니다.
- repo-local validator/registry 도구는 `bun`으로 실행됩니다.

### Setup Guarantees

setup 이후 기본적으로 보장되는 사항은 아래와 같습니다.

- `python` 없이 `bun`만으로 validator, runtime registry, report schema 도구를 실행할 수 있습니다.
- tracked 문서와 설정에는 사용자 개인 절대 경로나 특정 로컬 주소를 박아두지 않습니다.
- worktree preview URL은 별도 설정이 없으면 로컬 loopback 주소로 자동 계산됩니다.
- 필요하면 `CRUCIBLE_WORKTREE_PREVIEW_HOST`만 env로 override 해서 원격 preview 환경에 맞출 수 있습니다.

### Browser QA Tool

브라우저 QA가 필요한 프로젝트라면:

```bash
./setup --host claude --with-browser
# 또는
./setup --host codex --with-browser
```

이 흐름은 `.claude/tools/browser/` 아래에서 의존성을 설치하고
`bin/crucible-browse`를 생성합니다.

### Legacy Command

`install.sh`도 계속 사용할 수 있지만, 공개용 기본 진입점은 `./setup`입니다.

## What Using Crucible Looks Like

일반적인 흐름은 이렇습니다.

```text
/crucible-status
  "지금 상태 보여줘"

/crucible-spec
  "JWT 로그인 기능을 추가하고 싶어"

/crucible-plan
  "방금 만든 스펙 기준으로 설계와 태스크를 나눠줘"

/crucible-build
  "플랜대로 구현해줘"

/crucible-gate
  "테스트와 품질 게이트를 실행해줘"

/crucible-ship
  "릴리스 준비해줘"
```

핵심은 사용자가 `.claude`를 만지는 것이 아니라,
**프로젝트 코드 작업을 이 워크플로우 위에서 수행하는 것**입니다.

## Core Skills

| Skill | 역할 |
|-------|------|
| `/crucible-status` | 현재 phase, spec, ADR, git 상태를 보여줍니다. |
| `/crucible-spec` | 기능 요청을 스펙 문서로 정리합니다. |
| `/crucible-plan` | 스펙을 ADR과 구현 태스크로 분해합니다. |
| `/crucible-build` | 태스크를 구현 루프로 실행합니다. |
| `/crucible-gate` | 타입체크, 린트, 테스트, 스펙 준수를 검증합니다. |
| `/crucible-qa` | 브라우저 기반 QA를 수행합니다. |
| `/crucible-ship` | 릴리스와 배포 흐름을 정리합니다. |
| `/crucible-init` | 새 프로젝트에 Crucible 구조를 잡을 때 사용합니다. |

## How The Repo Is Structured

```text
.
├── .claude/
│   ├── CLAUDE.md
│   ├── agents/
│   ├── gates/
│   ├── hooks/
│   ├── memory/
│   ├── protocols/
│   ├── skills/
│   └── tools/
├── AGENTS.md
├── CLAUDE.md
├── VERSION
├── setup
└── install.sh
```

### Important Conventions

- `.claude/`는 framework source of truth 입니다.
- `.agents/`는 `./setup --host codex` 실행 시 생성되는 generated artifact 입니다.
- 일반 사용자는 `.agents/`를 직접 수정하지 않습니다.
- framework maintainer가 아닌 경우 `.claude`를 수정할 일은 거의 없습니다.
- live runtime state와 task report는 `.claude/runtime/` 아래에서 로컬로 관리되며 커밋하지 않습니다.

## Maintainer Mode vs User Mode

### User Mode

이 저장소를 설치한 뒤 자신의 프로젝트 코드 작업을 수행하는 모드입니다.

- `/crucible-*` 명령으로 작업
- spec → plan → build → gate → ship 순서 준수
- `.claude` 수정 대신 코드/테스트/문서 산출물 작업

### Maintainer Mode

Crucible 자체를 개선하는 모드입니다.

- `.claude/skills/`, `.claude/gates/`, `.claude/protocols/` 수정
- Codex 쪽 출력 반영이 필요하면 `./setup --host codex` 재실행
- 공개 정책, workflow, agent 역할을 바꿀 때 사용

## Current State

- public alpha
- fresh clone 기본 phase: `spec`
- `Claude Code`와 `Codex` repo-local 사용 흐름 지원
- `Adaptive Harness` 기반 Task Contract / evaluator / runtime registry 흐름 포함
- browser QA는 optional
- `Gemini`와 full semantic compiler는 아직 범위 밖

`.claude/memory/specs/`와 `.claude/memory/decisions/`는 starter 기준으로 비워 두었습니다.
fresh clone 후 첫 real project spec과 ADR은 사용자의 프로젝트 문맥에 맞게 채우는 것이 기본 흐름입니다.

## Troubleshooting

**Codex에서 skill이 안 보이면**

```bash
./setup --host codex
```

**브라우저 QA 바이너리가 없으면**

```bash
./setup --host claude --with-browser
```

**generated `.agents/`를 다시 만들고 싶으면**

```bash
./setup --host codex --force
```

**dry-run으로 확인만 하고 싶으면**

```bash
./setup --host codex --dry-run
```

## Docs

- [AGENTS.md](./AGENTS.md): Codex/agent용 운영 문서
- [CLAUDE.md](./CLAUDE.md): Claude Code용 운영 문서
- [.claude/CLAUDE.md](./.claude/CLAUDE.md): framework 내부 기준선
- [.claude/memory/README.md](./.claude/memory/README.md): memory 디렉토리 운영 규칙
- [.claude/runtime/README.md](./.claude/runtime/README.md): live runtime state 정책
- [.claude/protocols/constrained-claude-dialect.md](./.claude/protocols/constrained-claude-dialect.md): canonical 문법
- [.claude/protocols/codex-target-semantics.md](./.claude/protocols/codex-target-semantics.md): Codex 산출물 규칙
- [.claude/protocols/agent-manifest.md](./.claude/protocols/agent-manifest.md): optional manifest protocol

## License

[MIT](./LICENSE)
