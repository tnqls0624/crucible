# Codex Target Semantics v0

## 목적

이 문서는 `.claude` canonical source를 Codex용 repo-local artifact로 변환할 때 어떤 경로와 규칙을 따라야 하는지 정의합니다. 핵심은 생성 결과가 "예쁜 Markdown"이 아니라, 실제 Codex 세션에서 충돌 없이 읽히는 파생 산출물이어야 한다는 점입니다.

## Source of Truth

- 원본 문서: `.claude/**/*.md`
- 파생 산출물: `.agents/**`
- 원본 수정 위치: 항상 `.claude`
- generated file 직접 수정: 지원하지 않음

## Target Layout

| Canonical Kind | Codex Output Path |
|----------------|-------------------|
| `skill` | `.agents/skills/<pack-id>/SKILL.md` |
| `agent` | `.agents/<pack-id>.md` |

규칙:

- `<pack-id>`는 frontmatter의 `pack_id`를 그대로 사용합니다.
- root `AGENTS.md`는 생성 대상이 아닙니다.
- canonical source를 `.agents`로 복사하는 것이 아니라, Codex semantics에 맞는 파생본을 생성합니다.

## Generation Marker

모든 generated file은 아래 marker를 포함해야 합니다.

```md
<!-- generated-by: claude-first-pack-compiler v0 -->
```

frontmatter가 있는 문서는 호환성을 위해 marker를 frontmatter 바로 뒤에 둘 수 있습니다.
이 marker는 재생성 가능 파일과 사용자 수동 파일을 구분하는 기준입니다.

## 충돌 규칙

### 허용

- target path가 비어 있음
- 기존 파일이 generator marker를 포함함

### 금지

- 기존 파일이 존재하지만 generator marker가 없음
- target path가 root `AGENTS.md`를 덮어쓰는 흐름으로 이어짐
- `.agents` 내부의 사용자 수동 파일과 slug 충돌

금지 상황에서는 overwrite하지 않고 compile을 중단해야 합니다.

## Merge / Priority Rule

우선순위는 항상 아래와 같습니다.

1. `.claude` canonical source
2. compile-time validation result
3. generated `.agents` artifact

즉, `.agents` 산출물을 직접 고쳐서 source of truth를 바꾸는 방식은 허용하지 않습니다.

## Expected Codex Behavior

v0 acceptance는 최소한 아래를 만족해야 합니다.

- generated artifact가 Codex 세션에서 repo-local instructions로 읽힌다.
- 문서에 선언된 scope와 forbidden paths가 artifact에 보존된다.
- verification commands가 artifact에 남아 있어 작업 후 확인 경로가 보인다.
- 동일 입력은 동일 출력 경로와 동일한 핵심 본문을 만든다.

## Install Lifecycle

1. canonical pack 문서를 검증한다.
2. Codex target path를 계산한다.
3. 충돌 여부를 검사한다.
4. `./install.sh codex` 같은 설치 경로에서 generator marker를 포함한 산출물을 생성한다.
5. runtime acceptance 또는 conformance에서 결과를 검증한다.

## v0 Non-Goals

- global install
- best-effort merge
- 사용자 수동 편집과 generated file의 양방향 동기화
- Gemini/Cursor 타깃 동시 생성
