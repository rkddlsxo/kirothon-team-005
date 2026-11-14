# Kiro 활용 정리

이 저장소가 Kiro 기능을 어디에, 왜 쓰는지 정리한 문서다. 모든 항목은 실제 파일과 테스트로 확인할 수 있다.

## 한눈에 보기

| 기능 | 위치 | 개수 | 검증 |
|---|---|---|---|
| Specs | `.kiro/specs/` | 3개(제품, B 품질 개선, A 데스크톱 안정화) | tasks.md의 커밋·테스트 참조 |
| Steering | `.kiro/steering/` | 12개(always 6, fileMatch 4, auto 1, manual 1) | - |
| Hooks | `.kiro/hooks/` | 12개(B 공통 11, A `desktop-smoke-after-task` 1), 트리거 8종 | `test/hooks/hooks.test.js`, `test/hooks/config.test.js` |
| MCP | `scripts/mcp/cheatsheet-mcp.js` | 도구 5개 | `test/mcp/cheatsheet-mcp.test.js` |
| Custom agents | `.kiro/agents/` | 5개(역할 A·B·C, 보안 검토, PRD 오케스트레이터) | - |
| Skills | `.kiro/skills/` | 4개 | - |
| Workflows | `.kiro/workflows/` | 3개 | - |
| 제품 안의 Kiro | `src/ai/providers/kiro.js` | Kiro CLI headless 공급자 | `test/ai/providers.test.js`, `scripts/measure-kiro.js` |

## Specs: 요구사항 -> 설계 -> 작업

- `conversation-cheatsheet/`: PRD를 EARS 형식 요구사항 10개, 설계(아키텍처, 정확성 속성 5개), 작업 목록으로 옮긴 제품 명세.
- `ai-search-quality/`: B 역할의 품질 개선 명세. 요구사항 8개, 정확성 속성 5개, 작업마다 커밋 해시와 검증 테스트를 적었다. 사람이 해야 할 남은 작업(6.3, 8.5)도 그대로 남겨 두었다.
- `desktop-compat-hardening/`: A 역할의 데스크톱 안정화 명세. 요구사항 8개(호환성 측정, 미지원 안내, 창 배치, 패키징, 메신저 드래그, Kiro 로그인 화면), 정확성 속성 3개, 실기기 확인 작업은 사용자 몫으로 남겼다.

## Steering: 언제 무엇을 읽게 하는가

| 파일 | 포함 방식 | 내용 |
|---|---|---|
| `00-prd-first.md`, `product.md` | always | PRD 우선, 제품 원칙 |
| `tech.md` | always | 스택, 명령, Windows 실행 정책 우회, 코딩 규칙 |
| `structure.md` | always | 디렉터리, 의존 방향, 모듈 간 계약, 설계 문서 참조 |
| `team.md` | always | 역할 브랜치, 소유권, 커밋 규칙, TEAM_WORKFLOW.md 참조 |
| `security.md` | always | 개인정보·보안 규칙 7개, SECURITY_REVIEW.md 참조 |
| `ai-module.md` | fileMatch `src/ai/**` 등 | 검색·프롬프트·스키마·공급자 세부 규칙 |
| `desktop.md` | fileMatch `src/main/**` 등 | 선택 감지, IPC, BrowserWindow 보안 |
| `renderer.md` | fileMatch `src/renderer/**` | textContent, AI 추정 표시, 부족 표시 |
| `testing.md` | fileMatch `test/**` | 주입 방식, 실패 경로, 공격 입력, 비밀값 조합 |
| `kiro-cli-measure.md` | auto | Kiro 로그인·실측·튜닝 기준 |
| `release-checklist.md` | manual(`/release-checklist`) | 합치기·제출 전 9단계 |

`#[[file:...]]`로 설계 문서, 팀 규칙, 보안 검토, 요구사항을 직접 참조해 문서와 지침이 따로 놀지 않게 했다.

## Hooks: 규칙을 자동으로 지키게 한다

| Hook | 트리거 | 동작 |
|---|---|---|
| `guard-shell` | PreToolUse(shell) | force push, reset --hard, clean -f, branch -D, --no-verify, git config 변경, npm publish, 범위 밖 재귀 삭제를 exit 2로 차단 |
| `guard-write` | PreToolUse(write) | API 키·개인 키·.env 쓰기 차단(값은 출력하지 않음), 공유 영역·다른 역할 파일은 `permissionDecision: ask` |
| `test-on-save` | PostFileSave | 저장한 영역의 테스트만 실행(src/ai -> test/ai, test/core) |
| `security-check-on-save` | PostFileSave(src) | `scripts/check.js` 보안 정적 점검 |
| `prompt-change-review` | PostFileSave(prompt/schema) | 이스케이프, 날조 금지, 출처 검증, 스키마 계약 확인 지시 |
| `new-source-needs-test` | PostFileCreate(src) | 새 모듈에 테스트 짝 맞추기 |
| `project-context` | SessionStart | 브랜치 역할, 소유 디렉터리, 남은 spec 작업 주입 |
| `restore-context-after-compact` | PostCompact | 압축 뒤 같은 정보 복원 |
| `task-preflight` | PreTaskExec | 요구사항 번호·소유권·검증 테스트 먼저 확인 |
| `verify-after-task` | PostTaskExec | 전체 테스트 + 보안 점검 |
| `verify-on-stop` | Stop | 전체 테스트 + 보안 점검 |

판단 로직은 `scripts/hooks/lib.js`의 순수 함수로 두고 `test/hooks/`에서 차단·허용 사례를 검증한다. 모든 hook은 `node`를 직접 호출해서 PowerShell 실행 정책의 영향을 받지 않는다.

## MCP: 앱의 실제 모듈을 Kiro 도구로

`cheatsheet-dev`는 의존성 없는 stdio MCP 서버다. 개발 중 Kiro가 앱과 똑같은 코드로 확인하게 한다.

| 도구 | 용도 |
|---|---|
| `wiki_search` | 앱과 같은 단계별 위키백과 검색, 시도 순서 확인 |
| `build_prompt` | 모델에 실제로 보내는 프롬프트 확인(이스케이프 포함) |
| `verify_result` | 모델 응답을 앱 스키마로 정규화, 강등 수와 부족분 확인 |
| `support_score` | 문장과 출처 본문의 근거 점수 |
| `project_status` | 브랜치 역할, 남은 spec 작업, 선택적으로 테스트·보안 점검 |

`ai-search`, `ui-docs`, `security-reviewer` agent가 `mcpServers`로 이 서버를 선언한다. 워크스페이스 전체에서 쓰려면 `.kiro/settings/mcp.json`에 아래를 추가한다. 네트워크를 쓰는 `wiki_search`는 자동 승인에서 뺐다.

```json
{
  "mcpServers": {
    "cheatsheet-dev": {
      "command": "node",
      "args": ["scripts/mcp/cheatsheet-mcp.js"],
      "disabled": false,
      "autoApprove": ["build_prompt", "verify_result", "support_score", "project_status"]
    }
  }
}
```

## Custom agents, Skills, Workflows

- Agents: 역할별(`desktop-integration`, `ai-search`, `ui-docs`)로 소유 파일, 지킬 계약, 허용 셸 명령(`permissions.rules`)을 나눴다. `security-reviewer`는 쓰기 도구 없이 검토만 한다.
- Skills: `kiro-measure`(실측·튜닝), `source-grounding-review`(출처 근거 검토), `release-check`(합치기 전 확인), `prd-to-repo`(최초 생성).
- Workflows:
  - `ai-quality-loop`: 계획 -> 구현·측정을 상태 파일 기준으로 최대 3회 반복 -> 보안·출처 검토 병렬 -> 통합.
  - `pre-merge-review`: 검증 실행 -> 보안·테스트·소유권 검토 병렬(allSettled) -> 합치기 판단.
  - `prd-to-repo`: PRD에서 저장소 생성.

## 제품 안의 Kiro

결과 문장 생성 공급자로 Kiro CLI headless 모드(`kiro-cli chat --v3 --no-interactive`)를 쓴다.
- 프롬프트는 stdin으로만 전달하고, 도구 신뢰 옵션을 주지 않아 텍스트 생성만 한다.
- 저장소의 `.kiro/` 설정이 사용자 결과에 섞이지 않도록 앱 전용 임시 폴더에서 실행한다.
- 실측은 `scripts/measure-kiro.js`로 한다. kiro-cli 로그인 세션이나 `KIRO_API_KEY`가 필요하다. 결과는 `.kiro/specs/ai-search-quality/tasks.md` Task 6에 기록한다.
