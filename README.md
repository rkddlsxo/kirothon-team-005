# 아는척

<img src="docs/assets/icon.svg" alt="아는척 아이콘" width="72" />

대화 중 모르는 말이 나왔을 때, 화면의 그 텍스트를 드래그만 하면 바로 꺼낼 수 있는 문장과 예상 질문 답변, 화제 전환 문장을 보여 주는 Windows 데스크톱 대화 보조 앱입니다.

**Demo:** Windows 11용 실행 파일(프리릴리스) [v0.1.0 다운로드](https://github.com/rkddlsxo/kirothon-team-005/releases/tag/v0.1.0) (Kiro CLI 설치·로그인 필요). 시연 영상: https://www.youtube.com/watch?v=CRDiLVGu2TQ&feature=youtu.be

![결과 창](docs/assets/screenshot.png)

---

## 1. 문제 정의

### 대상 사용자

- 친구·지인과 메신저(카카오톡, 디스코드)로 대화하다가 모르는 유행어, 밈, 고유명사를 만나는 사람
- 회의, 수업, 협업 채팅에서 낯선 주제가 나왔을 때 대화에 끼어들고 싶은 사람

### 문제 상황

1. 메신저로 대화하던 사람이(누가) 상대가 모르는 유행어나 주제를 꺼내면(상황), 검색하고 읽는 동안 대화 흐름을 놓친다(불편).
2. 설명을 찾아 읽어도(상황), 그래서 실제로 무슨 말을 해야 자연스러운지 바로 떠오르지 않고, 상대가 되물으면 다시 막힌다(불편).
3. 화면에서 대화 소재를 발견한 사람이(누가) 내용을 복사해 브라우저나 AI 서비스를 열고 붙여 넣는 동안(상황), 손이 여러 번 가고 대화 창을 떠나야 한다(불편).

### 기존 방식과 한계

| 기존 방식 | 한계 |
|---|---|
| 검색 엔진에서 직접 검색 | 결과를 읽고 요약하는 시간이 걸리고, "뭐라고 말할지"는 스스로 만들어야 한다 |
| 범용 AI 챗봇에 붙여 넣기 | 복사, 앱 전환, 붙여 넣기, 질문 입력을 매번 해야 하고, 출처 없는 답을 사실처럼 말할 위험이 있다 |
| 모르는 채로 넘어가기 | 대화에 끼지 못하거나, 아는 척하다가 틀린 말을 하게 된다 |

### 근거

- 기존 방식(검색 엔진·AI 챗봇)으로 한 번 확인하려면 드래그 → 복사 → 앱 전환 → 붙여 넣기 → 결과 읽기 → 할 말 정리의 6단계가 필요하다(팀이 직접 단계를 세어 비교).
- 정량 설문 자료는 아직 없다. 문제 상황은 [PRD.md](PRD.md) 2장(불편한 상황)에 정리한 팀원들의 일상 경험을 바탕으로 한다.

### 목표

- 6단계를 "드래그 한 번"으로 줄여, 대화 창을 떠나지 않고 1초 안에 결과 창을 띄운다.
- 바로 쓸 문장 5개 이상, 예상 질문 5개 이상(질문마다 답변 2개 이상), 화제 전환 3개 이상을 준다.
- 출처로 확인된 내용만 사실로 표시하고, 모르는 것은 지어내지 않는다.

---

## 2. 핵심 기능

| 기능 | 해결하는 불편 | 코드 위치 |
|---|---|---|
| 드래그 즉시 분석 | 복사·앱 전환·붙여 넣기(문제 3). UI Automation으로 선택한 텍스트만 읽어 커서 옆에 결과 창을 띄움. 비밀번호 입력란 제외 | `src/native/selection.ps1`, `src/main/selectionWatcher.js`, `src/main/main.js` |
| 메신저 드래그(카카오톡·디스코드) | 메신저 말풍선은 선택을 알려 주지 않는 문제. 커서 아래 요소 탐색, 사용자가 켜는 "메신저 드래그 복사"(Ctrl+C 후 원래 클립보드 복원) | `src/native/selection.ps1`(`Read-SelectionAtPoint`, `Invoke-CopyFallback`), `src/main/main.js`(`setCopyFallback`) |
| 근거 있는 정보 | 검색하고 요약하는 시간(문제 1). 위키백과 검색과 재검색(핵심 단어, 영어 위키백과), 출처명·링크·확인 시점 표시 | `src/ai/search.js` |
| 출처 검증 | 출처 없는 말을 사실처럼 하는 위험. 검색된 출처 ID이면서 본문과 내용이 겹칠 때만 출처 표시 | `src/ai/schema.js` |
| 유행어·밈 뜻풀이, 뜻 먼저 보기 | 모르는 말 자체를 이해하는 시간(문제 1) | `src/ai/prompt.js`, `src/renderer/view.js`(`quickMeaning`) |
| 바로 쓸 문장 5개+, 예상 질문 5개+ x 답변 2개+, 화제 전환 3개+ | 할 말이 떠오르지 않고 되물으면 막힘(문제 2). 일상/업무 말투, 문장별 복사·다시 만들기, 예상 질문은 "AI 추정" 표시 | `src/core/service.js`, `src/ai/prompt.js`, `src/renderer/renderer.js` |
| 실제로 받은 질문에 답하기 | 상대가 되물었을 때(문제 2). 기존 주제와 말투를 유지해 답변 생성 | `src/core/service.js`(`followup`) |
| Kiro로 문장 생성 | 자연스러운 문장 생성. Kiro CLI headless를 앱 전용 임시 폴더에서 실행 | `src/ai/providers/kiro.js` |
| Kiro 로그인 첫 화면 | 처음 쓰는 사람이 터미널을 몰라도 시작. GitHub·Google·Builder ID 로그인 버튼, 연결 전 분석 차단 | `src/main/kiroLogin.js`, `src/renderer/index.html`(`#gate`) |
| 수동 대체 경로 | 자동 감지가 안 되는 앱. 붙여 넣기 입력, 복사 후 `Ctrl+Alt+Space` | `src/main/main.js`(`analyzeClipboard`) |

## 3. 사용 시나리오

1. 친구가 카카오톡에 "나 요즘 치이카와 토벌하러 가야해"라고 보낸다. 말풍선의 "치이카와 토벌"을 드래그한다.
2. 1초 안에 커서 옆에 결과 창이 뜨고, 검색된 뜻이 먼저 짧게 보인다. 이어서 "치이카와", "토벌"의 뜻풀이와 맨 위의 "지금 바로 쓸 문장"이 나온다. 복사 버튼을 눌러 답장 칸에 붙여 넣는다.
3. 친구가 "너도 그거 알아?"라고 되물으면, "실제로 받은 질문에 답하기" 칸에 입력해 답변 후보를 받는다.
4. 주제를 바꾸고 싶으면 "화제 전환"에서 자연스럽게 넘어가는 문장을 고른다.

## 4. 기대 효과

| 항목 | 기존 | 아는척 | 근거 |
|---|---|---|---|
| 확인까지 필요한 조작 | 6단계(드래그, 복사, 앱 전환, 붙여 넣기, 읽기, 할 말 정리) | 1단계(드래그) | 팀이 단계를 세어 비교 |
| 드래그 후 결과 창이 뜨기까지 | 앱 전환 필요 | 약 0.7~1.2초 | 메모장, 크롬, 워드, 카카오톡 실측(`docs/COMPATIBILITY.md`) |
| 대화에 쓸 문장이 나오기까지 | 직접 생각 | 약 20.7~28.0초(중앙값 22.9초) | Kiro CLI 실측 3회(`.kiro/specs/ai-search-quality/tasks.md` 6.1) |
| 한 번에 받는 대화 재료 | 0개(직접 정리) | 문장 5개 이상, 예상 질문 5개 이상 x 답변 2개 이상, 화제 전환 3개 이상 | 목표 개수 충족 3/3(같은 실측) |

## 5. 차별점

- 단순 요약이 아니라 **바로 말할 문장 + 예상 질문과 답변 + 화제 전환**까지 한 화면에 준다.
- 모델이 붙인 출처를 믿지 않고, 검색된 출처 ID이면서 본문이 문장을 뒷받침할 때만 출처로 표시하는 **사실 검증 계층**이 있다. 출처가 없으면 "일반 표현", 추정은 "AI 추정"으로 구분한다.
- 대화 속 유행어·밈·신조어·고유명사를 먼저 풀어 준다. 확신이 낮은 풀이는 그렇게 표시한다.
- 다른 앱을 쓰는 중에 **드래그 한 번**으로 동작한다. 카카오톡·디스코드 말풍선도 지원한다.
- 선택한 텍스트와 결과는 파일이나 로그에 남기지 않고, 다른 앱에 자동으로 입력하지 않는다.

---

## 6. 설치와 실행

### 실행 파일로 쓰기 (사용자)

```powershell
# 1. Kiro CLI 설치 (Windows 11, PowerShell)
irm 'https://cli.kiro.dev/install.ps1' | iex

# 2. 릴리스에서 aneuncheok-0.1.0-portable.exe를 받아 실행
#    (코드 서명이 없어 SmartScreen이 막으면 "추가 정보 -> 실행")
# 3. 첫 화면에서 GitHub, Google, AWS Builder ID 중 하나로 Kiro에 로그인
```

로그인하면 시작 화면으로 넘어갑니다. 창 오른쪽 위 "자동 분석"을 켜고(동의 안내가 뜹니다) 메모장, 크롬 등에서 텍스트를 드래그하세요. 카카오톡·디스코드 말풍선은 함께 뜨는 "메신저 드래그 복사"에 동의하면 드래그로 쓸 수 있고, 트레이 메뉴에서 언제든 켜고 끌 수 있습니다.

### 소스로 실행하기 (개발자)

요구 사항: Windows 11, Node.js 20 이상, Kiro CLI.

```bash
# 1. 의존성 설치
npm install
# electron 설치 스크립트가 차단된 환경이라면:
node node_modules/electron/install.js

# 2. 실행
npm start

# 3. 실행 파일 만들기 (dist/에 portable exe)
npm run dist
```

### AI 공급자 설정

| 공급자 | 설정 | 비고 |
|---|---|---|
| Kiro CLI(기본) | `kiro-cli login` 또는 `KIRO_API_KEY`. `KIRO_CLI_PATH`로 경로, `KIRO_TIMEOUT_MS`로 제한 시간(기본 120초) 지정 | `kiro-cli chat --v3 --no-interactive`에 stdin으로 프롬프트 전달, 앱 전용 임시 폴더에서 실행. PATH에 없으면 `%LOCALAPPDATA%\Kiro-Cli\kiro-cli.exe`를 찾음 |
| OpenAI 호환 | `CHEAT_LLM_BASE_URL`, `CHEAT_LLM_API_KEY`, `CHEAT_LLM_MODEL` | https 또는 localhost만 허용. Kiro 로그인은 이 경우에도 필요 |

### 알려진 제한

- 자동 감지는 대상 앱이 UI Automation 선택 정보를 주거나, 메신저 드래그 복사 대상(카카오톡·디스코드)일 때 동작합니다. 안 되는 앱에서는 앱이 한 번 안내하고, 복사 후 `Ctrl+Alt+Space`나 붙여 넣기를 쓰면 됩니다. 앱별 결과는 [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).
- 메신저 드래그 복사를 켜면 Windows 클립보드 기록(Win+V)에 대신 복사한 내용이 남을 수 있습니다.
- 문장 생성은 내 Kiro 계정 크레딧을 씁니다. Kiro 구독을 최종 사용자 서비스에 쓰는 것의 허용 여부는 확인 중입니다([docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)).
- 검색은 위키백과 기반이라 최신 뉴스성 주제는 부족할 수 있고, 부족하면 화면에 표시합니다.

## 7. 테스트

```bash
npm test                  # 단위 + 속성 기반 테스트 172개 (node --test "test/**/*.test.js")
npm run check             # 보안 정적 점검 (렌더러 XSS, 셸 실행, 키 입력·클립보드 범위, 외부 브라우저 열기 등)
npm run smoke             # 실제 Electron 창에서 위키백과 검색 -> 결과 렌더링 (네트워크 필요)
node scripts/smoke.js --gate   # Kiro 로그인 첫 화면 흐름
npm run compat            # 앱별 선택 감지 측정(3초 안에 대상 앱에서 드래그)
node scripts/measure-kiro.js --runs 1   # Kiro CLI 응답 시간·JSON 준수율 실측(로그인 필요)
```

문서: 명세 `.kiro/specs/`(제품 `conversation-cheatsheet`, AI·검색 `ai-search-quality`, 데스크톱 `desktop-compat-hardening`), 보안 검토 [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md), Kiro 활용 [BUILD_REPORT.md](BUILD_REPORT.md)·[docs/KIRO_USAGE.md](docs/KIRO_USAGE.md), 원본 PRD [PRD.md](PRD.md).

---

## 팀

- **팀 번호:** team-005
- **팀명:** 기세

| 이름 | 역할 |
|---|---|
| 이현지 | C. UI·문서·발표: 결과 창, README, BUILD_REPORT, 발표 자료 |
| 강인태 | B. AI·검색: 위키백과 검색 보강, 출처 검증, 프롬프트, Kiro CLI 연동·실측, Kiro 개발 도구(Hook, MCP) |
| 이윤태 | A. 데스크톱 통합: 선택 감지, 메신저 드래그, 창·트레이, Kiro 로그인 화면, 패키징·릴리스 |
