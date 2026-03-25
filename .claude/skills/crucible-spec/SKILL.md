---
name: crucible-spec
description: |
  피처 사양(Specification) 문서를 작성하고 검증합니다. 사용자의 기능 요청을 구조화된 .spec.md 문서로 변환하여 .claude/memory/specs/에 저장하고, gate-spec 검증을 통과시킵니다. Spec-Driven Development(SDD) 방법론을 적용하여 AI가 추측 없이 정확하게 구현할 수 있도록 합니다.

  ALWAYS use this skill when:
  - 사용자가 `/crucible-spec` 명령을 사용할 때
  - "새 기능", "피처 추가", "기능 구현", "기능을 만들고 싶어" 언급 시
  - "요구사항 정리", "스펙 작성", "요구사항 문서", "specification" 언급 시
  - "인증 기능", "결제 시스템", "알림 기능", "검색 기능" 등 구체적 피처를 구현하겠다고 할 때
  - Crucible 프로젝트에서 코드 작성 전 요구사항을 먼저 정리해야 할 때
  - 사용자가 어떤 기능을 만들고 싶다고 말했지만 아직 스펙이 없을 때

  Example triggers: "JWT 로그인 기능 스펙을 정리하고 싶어", "결제 시스템 요구사항을 정리해야 돼", "이 기능 스펙을 작성해줘"
---

# /crucible-spec — 피처 사양 작성

코드를 작성하기 전에 스펙을 먼저 확정하면 AI의 구현 정확도가 크게 올라갑니다. 스펙이 없으면 AI는 추측에 의존하게 되고, 재작업이 반복됩니다. 이 스킬은 사용자의 막연한 요청을 검증 가능한 계약서로 변환합니다.

## Prerequisites

- Crucible 프로젝트 초기화 완료 (`.claude/CLAUDE.md` 존재)
- 현재 Phase가 `spec` (아니면 사용자에게 현재 단계를 안내하고 오버라이드 여부 확인)

## Workflow

### Step 1: 피처 요청 분석

사용자의 요청에서 3가지를 추출합니다:
- **핵심 목적**: 무엇을 하려는가?
- **대상 사용자**: 누가 사용하는가?
- **성공 기준**: 어떻게 되면 성공인가?

대화에서 이미 언급된 내용은 재질문하지 않습니다. 부족한 부분만 간결하게 묻습니다.

**Example:**
```
사용자: "JWT 로그인 기능을 추가하고 싶어"
→ 핵심 목적: 로그인 기능 추가
→ 대상 사용자: 서비스 사용자
→ 성공 기준: 확인 필요 → "로그인만 이번 사이클 범위인가요, 회원가입과 비밀번호 재설정도 포함인가요?"
```

### Step 2: 스펙 문서 생성

`.claude/skills/crucible-spec/references/spec-template.md`를 읽어 템플릿을 기반으로 스펙을 작성합니다. 모든 섹션을 채울 필요는 없습니다 — 해당 피처에 관련 없는 섹션(예: CLI 도구에 API Contract)은 생략합니다.

**파일 경로**: `.claude/memory/specs/{feature-name}.spec.md`

### Step 3: Feature ID 할당

- 형식: `F{3자리 숫자}` (예: F001, F002)
- 기존 `.claude/memory/specs/`를 확인하여 다음 번호를 자동 결정
- 하위 피처: `F001.1`, `F001.2` 형식

Feature ID가 있어야 나중에 `/crucible-gate`에서 스펙 대비 구현 완료율을 자동 측정할 수 있습니다.

### Step 4: gate-spec 검증

`.claude/gates/gate-spec.md`를 읽고 모든 통과 조건을 확인합니다. 핵심 체크:
- Problem Statement, User Journey, Feature IDs, Technical Constraints, Acceptance Criteria, Data Model 섹션 존재
- 각 섹션이 비어있지 않음

실패한 항목이 있으면 해당 부분만 보완하고 재검증합니다. 사용자에게 게이트 실패를 알리되 직접 수정해서 통과시킵니다.

### Step 5: 사용자 리뷰

완성된 스펙을 사용자에게 제시합니다. 피드백이 있으면 반영하고, 승인받으면 Phase를 전환합니다.

### Step 6: Phase 전환

gate-spec 통과 + 사용자 승인 시:
1. `CLAUDE.md`의 Phase를 `plan`으로 업데이트
2. `settings.json`의 `CRUCIBLE_PHASE`를 `plan`으로 업데이트
3. `.claude/memory/specs/` 와 `.claude/memory/decisions/` 기준선에 새 피처 문서를 정렬

## Output Format

```markdown
## Crucible Spec Report

| 항목 | 값 |
|------|-----|
| Feature | {feature name} |
| ID | F001 |
| Gate | PASS |

### 다음 단계
`/crucible-plan` 으로 아키텍처 설계 및 태스크 분해를 진행하세요.
```

## Related Files

- **Template**: `.claude/skills/crucible-spec/references/spec-template.md` — 스펙 작성 시 읽어서 구조 참고
- **Gate**: `.claude/gates/gate-spec.md` — 통과 조건 정의
- **Storage**: `.claude/memory/specs/` — 완성된 스펙 저장 위치
