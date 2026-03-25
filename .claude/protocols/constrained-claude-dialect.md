# Constrained Claude Dialect v0

## 목적

이 문서는 `.claude` 안에서 authoring 하는 canonical source 형식을 정의합니다. 목표는 "Claude처럼 읽히는 Markdown"을 유지하면서도, parser와 validator가 추측하지 않아도 되는 최소 구조를 강제하는 것입니다.

v0에서는 자유로운 Markdown 전체를 지원하지 않습니다. 대신 사람이 읽기 쉬우면서도 기계가 안정적으로 해석할 수 있는 제한된 방언만 허용합니다.

## 파일 형태

- 파일 단위: 단일 Markdown 파일
- 필수 구성: YAML frontmatter + 고정 섹션 + `Policy/Contract Block`
- source of truth 위치: `.claude/**/*.md`
- v0 타깃 런타임: `codex`

## 필수 Frontmatter

다음 키는 모두 필수입니다.

| Key | Type | 설명 |
|-----|------|------|
| `pack_id` | string | kebab-case 식별자 |
| `name` | string | 사람이 읽는 이름 |
| `kind` | string | `skill` 또는 `agent` |
| `version` | string | 문서 버전 |
| `owner` | string | 문서 소유자 |
| `runtime_targets` | array | v0에서는 `["codex"]`만 허용 |
| `status` | string | `draft`, `reviewed`, `approved` 중 하나 |

예시:

```yaml
---
pack_id: chat-popup-scope-guard
name: Chat Popup Scope Guard
kind: skill
version: 0.1.0
owner: soobeen
runtime_targets:
  - codex
status: reviewed
---
```

## 필수 섹션

본문은 아래 섹션을 이 순서대로 포함해야 합니다.

1. `## Summary`
2. `## Use When`
3. `## Inputs`
4. `## Outputs`
5. `## Constraints`
6. `## Acceptance Checks`
7. `## Failure Modes`
8. `## Policy/Contract Block`

섹션 이름은 정확히 일치해야 하며, 누락 시 validation error입니다.

## Policy/Contract Block

`Policy/Contract Block` 섹션에는 fenced YAML block이 정확히 하나 있어야 합니다.

허용 스키마:

```yaml
policy:
  read_paths:
    - src/**
  write_paths:
    - src/**
  forbidden_paths:
    - infra/**
  allowed_tools:
    - read
    - edit
    - bash
  forbidden_actions:
    - force_push
    - delete_unrelated_files
  verification_commands:
    - npm test
```

### 필드 규칙

- `read_paths`: 읽어도 되는 경로 목록
- `write_paths`: 수정 가능한 경로 목록
- `forbidden_paths`: 절대 수정하면 안 되는 경로 목록
- `allowed_tools`: 런타임에서 사용 가능한 도구 카테고리
- `forbidden_actions`: 의미 단위의 금지 행위
- `verification_commands`: 작업 완료 후 확인해야 하는 명령

## v0 Supported Semantic Surface

v0에서 지원하는 의미 표면은 아래로 제한합니다.

- 명시적인 단일 runtime target
- 명시적인 read/write scope
- 명시적인 forbidden paths
- 명시적인 verification commands
- 단일 policy block
- 결정적인 출력 경로를 만들 수 있는 metadata

## v0 Rejected Surface

아래 항목은 warning이 아니라 compile error 대상입니다.

- `runtime_targets`에 `codex` 외 다른 값 포함
- 필수 섹션 누락
- 두 개 이상의 policy block
- 자유 문장 안에만 숨겨진 권한/금지 규칙
- 출력 경로를 추론해야 하는 모호한 metadata

## 작성 원칙

- 도구명보다 의도를 먼저 기술합니다.
- 정책은 본문에 흩뿌리지 말고 policy block에 모읍니다.
- 애매한 허용 범위보다 좁은 범위를 우선합니다.
- "나중에 해석하면 되겠지"가 아니라 "지금 문서만 읽고도 판단 가능"해야 합니다.
