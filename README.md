# Claude-First Pack Compiler

`Claude Code`용 `.claude` 문서를 canonical source of truth로 두고, 필요할 때 `Codex`용 `.agents` 산출물을 repo-local로 생성하는 documentation-first 프레임워크입니다.

현재 저장소는 구현 코드보다 문서 계약과 설치 흐름을 먼저 잠그는 `alpha` 단계입니다. 즉, "완성된 semantic parity compiler"가 아니라, 다른 개발자가 clone 후 바로 문서 구조를 이해하고 설치 실험까지 할 수 있는 공개 기준선을 제공합니다.

## 현재 상태

- source of truth: `.claude/**/*.md`
- 현재 공개 범위: `Claude Code` 직접 사용, `Codex`용 `.agents/` 생성
- 아직 범위 밖: `Gemini`, full semantic compiler, 자동 update-check

## 빠른 시작

### 1. 저장소 클론

```bash
git clone https://github.com/tnqls0624/crucible.git
cd crucible
```

### 2. Claude Code용 설치

`.claude` 문서를 그대로 사용하는 경우:

```bash
./install.sh claude
```

이 명령은 hook 스크립트 실행 권한을 정리하고, 현재 저장소가 `.claude` 기준선으로 사용 가능하도록 준비합니다.

### 3. Codex용 설치

`.claude` 문서를 바탕으로 repo-local `.agents/` 산출물을 생성하려면:

```bash
./install.sh codex
```

생성 결과:

- `.agents/*.md`
- `.agents/skills/*/SKILL.md`
- `.agents/skills/*/references/*.md`

`.agents/`는 generated artifact이므로 직접 수정하지 않고, 항상 `.claude`를 수정한 뒤 다시 설치합니다.

### 4. 브라우저 QA 도구까지 함께 설치

`crucible-qa`용 브라우저 바이너리까지 준비하려면 `bun`이 필요합니다.

```bash
./install.sh claude --with-browser
```

또는:

```bash
./install.sh codex --with-browser
```

이 명령은 `.claude/tools/browser/` 아래에서 의존성을 설치하고 `bin/crucible-browse`를 생성합니다.

## 설치 스크립트 옵션

```bash
./install.sh claude
./install.sh codex
./install.sh codex --with-browser
./install.sh codex --force
./install.sh codex --dry-run
```

- `--with-browser`: QA용 브라우저 바이너리까지 생성
- `--force`: 기존 generated `.agents/`를 덮어씀
- `--dry-run`: 실제 변경 없이 수행 예정 작업만 출력

## 저장소 구조

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
├── VERSION
└── install.sh
```

핵심 문서:

- `.claude/CLAUDE.md`: 현재 프로젝트 운영 계약
- `.claude/protocols/constrained-claude-dialect.md`: canonical 문법
- `.claude/protocols/codex-target-semantics.md`: Codex 산출물 의미
- `.claude/protocols/cross-model-compat.md`: 런타임 호환 정책

## 공개 저장소 원칙

- `.claude`가 source of truth입니다.
- `.agents`는 설치 시 생성되며 git에 커밋하지 않습니다.
- `.codex`, `settings.local.json`, session log 같은 로컬 상태는 커밋하지 않습니다.
- 브라우저 바이너리와 `node_modules`도 설치 시 생성합니다.

## 현재 한계

- 아직 `clone -> install -> production-grade compiler` 수준은 아닙니다.
- `Codex` 설치는 full compiler가 아니라 문서 기반 generated artifact 흐름입니다.
- `Gemini` 지원은 문서 설계만 있고 구현은 포함되지 않습니다.
- update-check, GitHub release artifact, signed provenance는 v0 설계 범위에만 있습니다.

## 권장 사용 방식

1. `.claude` 문서를 먼저 읽고 현재 규칙을 이해합니다.
2. `Claude Code`로 문서를 다듬거나, `./install.sh codex`로 `.agents`를 생성합니다.
3. generated 산출물이 아니라 `.claude` 문서를 수정합니다.
4. 브라우저 QA가 필요할 때만 `--with-browser`를 사용합니다.

## 라이선스 / 배포 메모

이 저장소는 현재 alpha 문서 기준선입니다. 외부에 공개할 때는 루트 GitHub 설명에 아래 성격을 함께 적는 것을 권장합니다.

- `documentation-first`
- `alpha`
- `Claude-first canonical docs`
- `Codex repo-local artifact generation`

라이선스는 [MIT](/Users/soobeen/Desktop/Project/worktree/LICENSE) 기준으로 두었습니다.
