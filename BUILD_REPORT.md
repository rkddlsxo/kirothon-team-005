# BUILD REPORT

아는척(대화 속 낯선 말을 드래그하면 뜻과 "원래 알던 사람처럼" 꺼낼 말을 보여 주는 Windows 앱)을 3명이 역할을 나눠 Kiro로 만든 기록입니다. 날짜와 수치는 모두 2026-11-14 로컬 실행 결과이고, 커밋 해시로 추적할 수 있습니다.

| 역할 | 담당 | 소유 영역 | 작업 브랜치 |
|---|---|---|---|
| A. 데스크톱 통합 | yunttai | `src/main/`, `src/native/`, `test/desktop/` | `feat/desktop`, `feat/messenger-drag`, `feat/kiro-login-gate`, `feat/release-v0.1.0` |
| B. AI·검색, Kiro 개발 환경 | rkddlsxo | `src/ai/`, `test/ai/`, `.kiro/` 공통 설정, `scripts/hooks/`, `scripts/mcp/` | `feat/ai` |
| C. UI·문서·발표 | guswl03 | `src/renderer/`, `README.md`, `BUILD_REPORT.md`, 발표 자료 | `feat/ui` |

역할과 공유 영역 규칙은 `docs/TEAM_WORKFLOW.md`와 `.kiro/steering/team.md`에 있습니다.

## Kiro 활용 내역

| 단계 | 사용한 Kiro 기능 | 무엇을 했는지 | 결과물 위치 |
|---|---|---|---|
| 기획 | Skill(`prd-to-repo`), Workflow(`prd-to-repo`), Steering(`00-prd-first`) | PRD.md를 읽고 FR-01~08, 비기능 요구, 완료 기준을 EARS 형식 요구사항 10개로 옮김. PRD를 먼저 읽게 하는 규칙을 항상 포함 steering으로 고정 | `.kiro/specs/conversation-cheatsheet/requirements.md`, `.kiro/skills/prd-to-repo/`, `.kiro/workflows/prd-to-repo.workflow.yaml` |
| 기획 | Spec(requirements) x 2 추가 | B: 검색·출처 품질과 Kiro 실측 요구사항 8개(EARS). A: 데스크톱 안정화 요구사항 8개(호환성 측정, 미지원 안내, 창 배치, 패키징, 메신저 드래그, Kiro 로그인 화면) | `.kiro/specs/ai-search-quality/requirements.md`, `.kiro/specs/desktop-compat-hardening/requirements.md` |
| 설계 | Spec(design) | 제품: 코어(`src/core`)와 Electron 어댑터 분리, Provider 추상화, 정확성 속성 5개. B: 정확성 속성 5개(구분자 탈출 불가, 출처 ID·내용 검증 등). A: 정확성 속성 3개(창이 항상 작업 영역 안 등) | 각 spec의 `design.md` |
| 설계 | Spec(tasks) | 세 spec 모두 의존성 그래프(waves)가 있는 작업 목록. 완료 작업마다 커밋 해시와 검증 테스트를 적고, 사람이 해야 할 실측 작업은 체크하지 않고 남김 | 각 spec의 `tasks.md` |
| 설계 | Steering 12개 | always 6(PRD 우선, 제품, 기술, 구조, 팀, 보안), fileMatch 4(AI, 데스크톱, 렌더러, 테스트), auto 1(Kiro 실측), manual 1(릴리스 체크리스트). `#[[file:...]]`로 설계 문서와 보안 검토를 직접 참조 | `.kiro/steering/` |
| 구현 | Custom agent 5개 | 역할별(`desktop-integration`, `ai-search`, `ui-docs`)로 소유 파일과 허용 셸 명령을 나누고, 쓰기 권한 없는 `security-reviewer`, PRD 오케스트레이터를 둠 | `.kiro/agents/` |
| 구현 | Kiro 에이전트 세션 (A) | 호환성 측정 도구, 드래그 감지와 미지원 안내, 창 배치 보정, 카카오톡·디스코드 드래그 감지와 복사 옵션, Kiro 로그인 첫 화면(GitHub·Google·Builder ID), 휴대용 exe 패키징 | `src/main/`, `src/native/selection.ps1`, `src/main/kiroLogin.js`, `scripts/compat*` |
| 구현 | Kiro 에이전트 세션 (B) | 검색 재시도, 출처 내용 검증, 프롬프트 구분자 보호, Kiro CLI 연동과 연결 확인, 밈 해설 중심 프롬프트, AI 한 줄 뜻, "아는척" 기본 말투 | `src/ai/`, `src/core/service.js` |
| 구현 | Kiro 에이전트 세션 (C) | 앱 이름 "아는척"과 Kiro 다크 테마, 아이콘, Enter 분석, 결과 창 버그 수정, 화면 판단 로직 분리(`view.js`) | `src/renderer/` |
| 구현 | 제품 안의 Kiro: Kiro CLI headless | 결과 문장 생성 공급자로 `kiro-cli chat --v3 --no-interactive`를 씀. 프롬프트는 stdin으로만 넘기고, 도구 신뢰 옵션 없이 텍스트 생성만 하며, 저장소 `.kiro/` 설정이 섞이지 않게 앱 전용 임시 폴더에서 실행. 시작할 때 `kiro-cli whoami`로 연결을 확인하고, 로그인 전에는 분석하지 않음 | `src/ai/providers/kiro.js`, `src/main/kiroLogin.js` |
| 검증 | Hooks 12개 | 위험한 git 명령 차단, 비밀값 쓰기 차단, 공유 영역 쓰기 확인, 저장 시 해당 영역 테스트와 보안 점검, 작업 전 소유권 확인, 작업 후·종료 시 전체 테스트, 작업 후 스모크(A), 세션 시작·압축 후 역할 정보 주입. 판단 로직은 순수 함수로 두고 테스트함 | `.kiro/hooks/`, `scripts/hooks/`, `test/hooks/` |
| 검증 | MCP 서버 `cheatsheet-dev`(도구 5개) | 앱의 실제 모듈로 위키백과 검색, 실제 프롬프트 생성(이스케이프 확인), 응답 정규화와 출처 강등 확인, 근거 점수, 브랜치 상태·테스트 실행을 Kiro 도구로 노출 | `scripts/mcp/cheatsheet-mcp.js`, `.kiro/settings/mcp.json`, `test/mcp/` |
| 검증 | Skill(`kiro-measure`) + 실측 스크립트 | Kiro CLI 응답 시간, JSON 파싱률, 목표 개수 충족률을 숫자만 남겨 측정. 스킬의 조치 표(JSON 실패, 개수 미달, 60초 초과, 출처 연결 0)로 튜닝 여부를 판단 | `.kiro/skills/kiro-measure/`, `scripts/measure-kiro.js`, `ai-search-quality/tasks.md` Task 6 |
| 검증 | Sub-agent 코드 리뷰 (A) | semantic reviewer로 A 변경분을 검토해 중간 5건, 낮음 8건을 받고, 조치 가능한 항목을 고친 뒤 정적 점검 규칙을 추가 | `docs/handoff/A-review.md`, `docs/SECURITY_REVIEW.md` |
| 검증 | Skill(`source-grounding-review`, `release-check`), Workflow(`ai-quality-loop`, `pre-merge-review`) | 출처 근거 검토 절차와 합치기 전 확인 절차를 스킬로 고정. 품질 개선 루프(최대 3회 반복 후 보안·출처 검토 병렬)와 합치기 전 검토(보안·테스트·소유권 병렬)를 워크플로로 정의 | `.kiro/skills/`, `.kiro/workflows/` |
| 기타 | Sub-agent(introspect) | Kiro CLI의 웹 검색 도구 이름과 비대화형 권한 동작을 공식 문서로 확인(밈 검색 보강 가능성 판단용) | 이 문서 "어려웠던 점" |
| 기타 | Kiro Crew 연동 안내 | Crew에서 이 저장소와 PRD.md로 `prd-to-repo` 스킬을 실행하는 요청문을 정리 | `docs/CREW_INTEGRATION.md` |
| 기타 | Kiro로 발표·문서 | README, 보안 검토(위협 표), 호환성 표, 역할별 인수인계, 발표 HTML과 PDF | `README.md`, `docs/`, `PRESENTATION.pdf` |

기능별 상세 정리는 [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md)에 있습니다.

## 역할별 상세

### A. 데스크톱 통합 (`.kiro/specs/desktop-compat-hardening/`, 작업 1~10)

- **호환성 측정**: `npm run compat`이 포커스된 컨트롤과 커서 아래 요소를 앱과 같은 순서로 확인하고, 선택 텍스트 내용이나 창 제목 없이 길이와 프로세스 이름만 출력합니다. 실측 결과는 메모장·크롬 지원(드래그), 워드·카카오톡 입력란 지원(키보드 선택), 카카오톡 말풍선은 복사 옵션 필요입니다(`docs/COMPATIBILITY.md`).
- **감지 개선과 미지원 안내**: PowerShell UI Automation 헬퍼에 드래그 감지를 넣고, TextPattern이 없는 프로그램에서는 프로세스당 한 번 대체 경로(복사 후 `Ctrl+Alt+Space`)를 안내합니다.
- **창 배치**: 작업 영역보다 큰 창, 멀티 모니터, 배율에서 창이 화면 밖으로 나가지 않게 보정하고 속성 테스트로 검증했습니다.
- **카카오톡·디스코드 드래그(PR #4)**: 커서 아래 요소와 상위 10단계를 탐색하고, 사용자가 동의하고 켠 경우에만 허용 메신저에서 Ctrl+C로 복사한 뒤 클립보드를 원래대로 되돌립니다. DPI 좌표 맞춤도 함께 고쳤습니다.
- **Kiro 로그인 첫 화면(PR #5)**: Kiro가 연결되지 않았으면 첫 화면에서 GitHub, Google, AWS Builder ID로 `kiro-cli login`을 실행합니다. CLI 출력 원문은 저장하지 않고 허용 도메인 주소와 일회용 코드만 뽑습니다. 사용자가 로그아웃 상태에서 실제 브라우저 로그인을 확인했습니다.
- **패키징·릴리스(PR #6)**: `npm run dist`로 휴대용 exe(105MB)를 만들고 `win-unpacked`를 스모크 모드로 확인했습니다. README Demo 줄에 v0.1.0 프리릴리스 링크를 넣었습니다.
- **리뷰 반영**: semantic reviewer가 잡은 결함(창 이동에도 뜨는 안내, 안내 문구와 단축키 동작 불일치, 왼손잡이 마우스 반전, 절대 경로 조합 오류)을 고쳤습니다.

### B. AI·검색과 Kiro 개발 환경 (`.kiro/specs/ai-search-quality/`, 작업 1~8)

- **Kiro 개발 환경 구축**: Hook 11개와 판단 로직 테스트, MCP 서버, steering 정리, 역할별 agent, skill 3개(`kiro-measure`, `source-grounding-review`, `release-check`), workflow 2개(`ai-quality-loop`, `pre-merge-review`)를 만들어 세 사람이 같은 규칙으로 작업하게 했습니다.
- **검색·출처 품질**: 원래 검색어 → 핵심 단어 → 영어 위키백과 순서로 재검색합니다. 모델이 붙인 출처는 ID와 본문 2-gram 겹침(`SUPPORT_MIN` 0.3)을 모두 통과해야 남깁니다. 선택 텍스트의 `</selected_text>` 같은 구분자 탈출을 막았습니다.
- **Kiro CLI 실측(Task 6)**: 6회 실행 결과 JSON 6/6, 목표 개수 충족 6/6, 응답 중앙값 22.7초(최대 28.0초)였습니다. `kiro-measure` 조치 표의 네 조건에 모두 해당하지 않아 튜닝하지 않았습니다.
- **오프라인 간이 모드 제거, Kiro 연결 표시(Task 8)**: 정해진 문형에 위키백과 문장을 끼워 넣어 어색하던 오프라인 모드를 없애고, Kiro를 기본 공급자로 만들었습니다. 창 하단에 연결 상태(연결됨, 로그인 필요, 미설치)를, 결과마다 실제로 만든 AI를 표시합니다.
- **밈 해설**: 유행어·밈 8가지 유형(아이돌 발언, 인방 유행어, 게임 용어, 캐릭터·팬덤, 은어·초성, 영어 섞인 신조어, 대사 따라 하기, 평범한 말의 다른 뜻)을 점검해 뜻, 유래, 이 문장에서의 뜻, 예문을 풀어 줍니다. 확신이 낮으면 "AI 추정"으로 표시하고 모르는 말은 지어내지 않습니다.
- **AI 한 줄 뜻**: 검색·전체 생성과 동시에 짧은 프롬프트로 Kiro에 따로 물어 약 6초 만에 맨 위에 보여 줍니다(전체 결과는 약 20초).
- **"아는척" 기본 말투**: 대화 문장을 "원래 알던 사람처럼 받아치기"로 만들고, "그게 뭐예요?", "잘 몰라서" 같은 모르는 티 나는 말을 금지했습니다. 경험·소유는 지어내지 않습니다.
- **JSON 깨짐 대응**: 실측 중 한 번 문자열 따옴표가 빠진 JSON이 나와, 출력 형식을 작업 지시 끝에 다시 강조하고 깨지면 한 번 자동 재시도합니다.

### C. UI·문서·발표 (PR #1, #2, #3)

- **결과 창 버그 수정**: 검색 부족 안내가 결과와 함께 지워지던 문제, "다시 만들기" 중복 요청, 후속 질문 Enter 연타와 한글 조합 중 Enter, 후속 질문 오류 표시 위치, 답변 영역에 "null" 글자가 들어가던 문제, `basis`가 `general`인데 "근거" 표시가 붙던 문제를 고쳤습니다.
- **판단 로직 분리**: DOM과 무관한 판단(안내 문구 조합, 재생성 중 상태, 출처 표시 여부, 제출 키, 진행 문구)을 `src/renderer/view.js`로 분리해 Node 테스트로 검증합니다. 서비스 이벤트 계약 테스트도 추가했습니다.
- **디자인**: 앱 이름을 "아는척"으로 바꾸고 Kiro IDE 다크 테마와 눈 아이콘을 적용했습니다. 항상 위 고정을 없애고, 입력 칸에서 Enter로 바로 분석합니다(Shift+Enter 줄바꿈).
- **문서·발표**: README, 발표 HTML과 PDF, 스크린샷을 기능 변경마다 갱신했습니다.

## 개발 과정에서 바뀐 점

| 처음 계획 | 바뀐 것 | 이유 |
|---|---|---|
| Kiro 연동이 안 될 때를 대비해 오프라인 간이 모드(검색 문장 인용) 제공 | 오프라인 모드를 없애고 Kiro를 기본 공급자로. 로그인 전에는 첫 화면에서 로그인하게 함 | 실제로 써 보니 오프라인 모드는 정해진 문형이라 맥락을 전혀 반영하지 못했고, 사용자가 Kiro로 만든 결과인지 구분할 수 없었음 |
| 낯선 "주제"를 위키백과로 설명 | 대화 속 유행어·밈·신조어를 먼저 풀이(terms)하고, 상대가 하려는 말을 쉽게 풀어 씀 | "나 요즘 치이카와 토벌하러 가야해"처럼 실제로 막히는 건 백과사전 지식이 아니라 요즘 말이었음. 위키백과에는 밈이 거의 없어 뜻풀이만은 모델의 일반 지식을 허용하고 확신도를 표시하게 함 |
| 상황에 맞는 대화 문장 생성 | "원래 알던 사람처럼" 받아치는 아는척 말투가 기본 | 첫 결과가 "그게 뭐예요?", "잘 몰라서" 같은 질문 위주라 앱 이름(아는척)과 맞지 않았음 |
| 회의·업무 상황 중심 | 일상 대화(메신저 단톡방, 모임)가 기본. 실측 표본도 일상 문장으로 교체 | 사용자 피드백: 거의 일상 대화 용도 |
| 한 줄 뜻은 검색 결과 첫 문장 | 한 줄 뜻도 Kiro가 따로 짧게 답하고, 응답 영역을 입력칸 위로 올림 | 검색 첫 문장은 AI 답변이 아니라 맥락이 없었고, 전체 결과(약 20초)를 기다리는 동안 볼 것이 필요했음 |
| 메모장·브라우저처럼 UI Automation이 되는 프로그램만 지원 | 카카오톡·디스코드는 커서 아래 요소 탐색, 안 되면 사용자가 켜는 복사 옵션 | 실측에서 카카오톡 말풍선은 UI Automation으로 선택을 알려 주지 않았음 |
| 검증 명령은 사람이 기억해서 실행 | Hook으로 저장 시 테스트·보안 점검, 작업 후 전체 테스트·스모크를 자동 실행 | 세 사람이 공유 파일(`service.js`, `main.js`)을 함께 고치면서 계약이 깨질 위험이 커졌음 |

## 어려웠던 점과 해결 방법

- **Kiro CLI 실측이 중간에 멈춤**: 처음 6회 측정이 3회 뒤 멈췄습니다(원인 미확인). 주제당 1회로 나눠 다시 재서 6회를 채웠고, 측정 스크립트는 생성 문장 없이 숫자만 남기게 해 개인정보 문제 없이 기록했습니다.
- **kiro-cli가 PATH에 없음**: 설치 직후 셸에서는 `kiro-cli`를 찾지 못했습니다. `resolveKiroCommand()`가 `KIRO_CLI_PATH` → PATH → `%LOCALAPPDATA%\Kiro-Cli\kiro-cli.exe` 순서로 찾게 했습니다.
- **모델이 최신 밈을 모름**: 프롬프트만으로는 학습 이후 밈을 알게 할 수 없습니다. Kiro CLI의 웹 검색 도구(`remote_web_search`)를 허용해 시험했지만, 이벤트 402개 중 도구 호출이 0건이라 이 방식은 쓰지 않았습니다. 대신 밈 유형 점검표로 아는 밈을 빠짐없이 찾게 하고, 모르면 "AI 추정"으로 정직하게 표시하게 했습니다. 실측에서 "럭키비키, 원영적 사고, 폼 미쳤다, 갓생, 킹받네, 알잘딱깔센"은 정확히 풀었고 "토벌"만 확신이 낮게 나왔습니다.
- **아는척과 정직함의 균형**: 아는척을 강하게 시키자 "봤지 ㅋㅋ"처럼 사용자의 경험을 지어내는 경우가 나왔습니다. 경험·소유는 지어내지 말고, 확실하지 않은 날짜·숫자·줄거리는 꺼내지 않게 규칙을 나눴습니다.
- **에이전트가 다른 앱에 키 입력을 보낼 수 없음(A)**: 카카오톡 복사 경로를 에이전트 환경에서 끝까지 실행하지 못했습니다. 판단 로직은 단위 테스트와 `check.js` 규칙으로 고정하고, 실기기 확인은 `docs/COMPATIBILITY.md` 체크리스트로 사람이 했습니다.
- **Windows 실행 정책**: 한동안 서명되지 않은 `electron.exe` 실행이 막혔습니다(C). 실제 `renderer.js`를 가짜 DOM에서 돌리는 임시 하네스로 24개 항목을 확인하고, PDF는 서명된 Edge로 만들었습니다. 모든 Hook과 스크립트는 `node`를 직접 호출해 PowerShell 정책의 영향을 받지 않게 했습니다.
- **역할 간 머지 충돌**: 세 사람이 같은 날 `src/main/main.js`, `preload.js`, `index.html`을 함께 고쳐 충돌이 났습니다. 예를 들어 로그인 화면(A)과 한 줄 뜻(B)이 겹쳤습니다. 양쪽을 모두 살려 해결하고, 합칠 때마다 테스트·보안 점검·스모크를 다시 돌렸습니다.
- **Kiro IDE에서 Hook이 동작하지 않음**: B 세션에서 `guard-shell`이 `git reset --hard`를 막지 못했고(작업 트리가 깨끗해 손실은 없었음), `guard-write`도 확인 창을 띄우지 않았습니다. Hook 정의가 Kiro CLI 형식이라 IDE가 읽지 않은 것으로 보입니다(원인 미확정). 같은 판단 로직을 `npm run check`와 테스트로도 돌려 보완했습니다.

## 최종 검증 결과

- `npm test`: 172개 중 172개 통과. 입력 검증, 검색·재검색, 스키마 정규화·출처 검증, 프롬프트(밈 해설·아는척·한 줄 뜻·구분자 보호), 서비스 흐름(한 줄 뜻, JSON 재시도, 늦은 응답 버림), 공급자와 Kiro 연결 확인, Kiro 로그인 흐름, 선택 감지·메신저 허용 목록, Hook, MCP, 화면 판단 로직, 속성 기반 테스트.
- `npm run check`: 보안 정적 점검 통과(openExternal, 메신저 키 입력·클립보드 규칙 포함).
- `npm run smoke`: 실제 Electron 창에서 한 줄 뜻이 검색 결과보다 먼저 표시되고, 뜻풀이 2개와 문장 5개·예상 질문 5개·화제 전환 3개가 렌더링되며, 입력칸이 결과 아래에 있는 것을 확인. 이벤트 순서 `start, stage:searching, quick, sources, stage:generating, result, stage:done`. 스모크는 외부 AI 대신 고정 응답 공급자를 씁니다.
- 실제 Kiro CLI(kiro-cli 3.3.0, 로그인 세션):
  - 기준선 6회: JSON 6/6, 목표 충족 6/6, 응답 20.0~28.0초(중앙값 22.7초).
  - 밈 해설 3회: JSON 3/3, 뜻풀이 7개 중 확실 6개·추정 1개, 목표 미달 1회(활용 문장 1/5).
  - 아는척 3회: 모르는 티 나는 표현 0/46문장, 목표 충족 3/3, 19~22초.
  - 한 줄 뜻 2회: 약 6초.
- 패키징: `npm run dist`로 휴대용 exe 생성, `win-unpacked` 스모크 통과(A).
- 사람이 확인: 로그아웃 상태에서 실제 브라우저 로그인 후 메인 화면 전환(A), 카카오톡 말풍선 드래그 복사 옵션 동작(A, `docs/COMPATIBILITY.md` 체크리스트 일부).

## 검증하지 못한 항목

- 카카오톡·디스코드 체크리스트 중 클립보드 보존, 입력란 보존, Shift 드래그, 지연 시간(`docs/COMPATIBILITY.md` 6~8, 10번).
- 워드와 카카오톡 입력란의 드래그 감지(키보드 선택만 확인).
- 휴대용 exe 파일 자체 실행(같은 내용인 `win-unpacked`로 대신 확인). 코드 서명이 없어 SmartScreen 경고가 뜰 수 있습니다.
- 멀티 모니터와 배율 150% 이상에서의 실제 창 위치(좌표 계산 테스트로만 확인).
- 일상 대화 표본으로 `measure-kiro.js` 재측정(`ai-search-quality` 8.5).
- Kiro 구독을 최종 사용자 서비스에 써도 되는지(규정 미확인).
- Kiro CLI의 웹 검색으로 최신 밈을 찾는 방식(도구가 호출되지 않아 원인 미확인).
