'use strict';
// 렌더러: innerHTML을 쓰지 않고 textContent로만 DOM을 만든다(XSS 방지).
const $ = (id) => document.getElementById(id);
const bridge = window.api;
const view = window.CCView;

const state = { reqId: 0, result: null, sources: [], search: null, app: null, busy: false, fuBusy: false, fuSeq: 0 };
const pending = view.createPending();   // 재생성 중인 항목

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}
async function copy(text) { await bridge.copy(text); toast('복사했어요'); }

const tone = () => document.querySelector('input[name=tone]:checked').value;
function setTone(v) { const r = document.querySelector(`input[name=tone][value=${v}]`); if (r) r.checked = true; }

function setStatus(msg) { const s = $('status'); s.hidden = !msg; s.textContent = msg || ''; }
function setError(msg) { $('error').hidden = !msg; $('errorText').textContent = msg || ''; }
function setNotice(msg) { const n = $('notice'); n.hidden = !msg; n.textContent = msg || ''; }

function srcBadges(ids) {
  if (!ids || !ids.length) return h('span', { class: 'badge gen' }, '일반 표현 · 출처 없음');
  return ids.map((id) => h('span', { class: 'badge src' }, `근거 ${id}`));
}

function copyBtn(text) { return h('button', { onclick: () => copy(text), 'aria-label': `복사: ${text.slice(0, 20)}` }, '복사'); }
function setRegenBusy(btn, busy) {
  btn.disabled = busy;
  btn.textContent = busy ? '만드는 중…' : '다시 만들기';
  if (busy) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
}
function regenBtn(kind, index) {
  const key = view.pendingKey(kind, index);
  const btn = h('button', { 'aria-label': '이 항목만 다시 만들기' }, '다시 만들기');
  setRegenBusy(btn, pending.has(key));
  btn.addEventListener('click', async () => {
    const token = pending.start(key);
    if (token === null) return;                    // 이미 만드는 중
    setRegenBusy(btn, true);
    try { await bridge.regenerate({ kind, index, direction: $('direction').value }); }
    finally {
      pending.finish(key, token);
      if (btn.isConnected) setRegenBusy(btn, false); // 결과로 다시 그려졌으면 새 버튼이 이미 있음
    }
  });
  return btn;
}

function render() {
  const r = state.result;
  $('results').hidden = !r;
  if (!r) return;
  const terms = r.terms || [];
  $('meaning').hidden = !r.context && !terms.length;
  $('contextLine').hidden = !r.context;
  $('contextLine').textContent = r.context ? `쉽게 말하면: ${r.context}` : '';
  $('terms').replaceChildren(...terms.map((t) => h('li', {},
    h('div', { class: 'termHead' }, h('strong', {}, t.term),
      t.sourceIds.length ? srcBadges(t.sourceIds)
        : h('span', { class: t.confidence === 'high' ? 'badge gen' : 'badge est' }, t.confidence === 'high' ? 'AI 설명 · 출처 없음' : 'AI 추정 · 확실하지 않아요')),
    h('p', { class: 'text' }, t.meaning),
    t.origin ? h('p', { class: 'hint' }, `유래: ${t.origin}`) : null,
    t.inThisText ? h('p', { class: 'inText' }, `이 문장에서는: ${t.inThisText}`) : null,
    t.example ? h('p', { class: 'hint' }, `예: ${t.example}`) : null)));
  const first = r.statements[0];
  $('heroText').textContent = first ? first.text : '활용할 문장을 만들지 못했어요.';
  $('heroMeta').replaceChildren(...(first ? [].concat(srcBadges(view.statementSourceIds(first))) : []));
  $('heroCopy').disabled = !first;
  $('heroCopy').onclick = () => first && copy(first.text);

  $('statements').replaceChildren(...r.statements.map((s, i) => h('li', {},
    h('p', { class: 'text' }, s.text),
    h('div', { class: 'meta' }, srcBadges(view.statementSourceIds(s))),
    h('div', { class: 'actions' }, copyBtn(s.text), regenBtn('statement', i)))));

  $('questions').replaceChildren(...r.questions.map((q, qi) => h('details', { class: 'q' },
    h('summary', {}, q.question),
    h('ul', {}, q.answers.map((a) => h('li', {},
      h('p', { class: 'text' }, a.text),
      h('div', { class: 'actions' }, copyBtn(a.text), srcBadges(a.sourceIds)))),
      h('li', {}, h('div', { class: 'actions' }, regenBtn('question', qi)))))));

  $('switches').replaceChildren(...r.topicSwitches.map((s, i) => h('li', {},
    h('div', { class: 'meta' }, h('span', { class: 'badge' }, s.topic)),
    h('p', { class: 'text' }, s.line),
    h('div', { class: 'actions' }, copyBtn(s.line), regenBtn('switch', i)))));

  $('facts').replaceChildren(...r.keyFacts.map((f) => h('li', {}, f.text, ' ', srcBadges(f.sourceIds))));
  // 검색 부족/실패 안내는 결과가 와도 유지한다.
  const search = state.search || {};
  setNotice(view.composeNotice({ searchStatus: search.status, searchError: search.error, shortfalls: r.shortfalls }));
}

function renderSources(ev) {
  state.sources = ev.sources || [];
  state.search = { status: ev.status, error: ev.error };
  const msg = view.searchMessage(ev.status, ev.error);
  $('srcStatus').textContent = msg;
  if (msg) setNotice(msg);
  $('sources').replaceChildren(...state.sources.map((s) => h('li', {},
    h('strong', {}, `${s.id} · ${s.name}`), h('br'),
    h('button', { class: 'linkbtn', onclick: () => bridge.openLink(s.url) }, '원문 열기'),
    h('span', { class: 'hint' }, ` · 확인 시점 ${new Date(s.retrievedAt).toLocaleString('ko-KR')}`))));
}

function onEvent(ev) {
  if (ev.type === 'invalid') {
    if (view.invalidTarget(ev) === 'followup') { setFuBusy(false); showFuMessage(ev.message); return; }
    setStatus(''); setError(''); setNotice(ev.message); return;
  }
  if (ev.type === 'notice') { setNotice(ev.message); return; }
  if (ev.type === 'start') {
    state.reqId = ev.requestId; state.result = null; state.search = null; setError(''); setNotice('');
    pending.clear(); state.fuSeq += 1; setFuBusy(false); hideQuick();
    $('fuOut').replaceChildren(); $('results').hidden = true; setTone(ev.tone); setBusy(true); return;
  }
  if (ev.requestId !== state.reqId) return;        // 이전 요청의 늦은 응답 무시
  switch (ev.type) {
    case 'stage':
      if (ev.stage === 'searching' || ev.stage === 'generating') setStatus(view.stageMessage(ev.stage, ev.providerId));
      else { setStatus(''); setBusy(false); }
      break;
    case 'sources': renderSources(ev); break;
    case 'quick': showQuick(ev); document.querySelector('main').scrollTop = 0; break;
    case 'result':
      // 한 줄 뜻(AI)은 전체 결과가 와도 맨 위에 그대로 둔다.
      state.result = ev.result; $('providerNote').textContent = `생성: ${ev.provider}`;
      showGeneratedBy(ev.providerId, ev.provider); setStatus(''); render(); setBusy(false);
      document.querySelector('main').scrollTop = 0; break;
    case 'error': setStatus(''); setBusy(false); setError(ev.message); break;
    case 'regenerated':
      pending.finish(view.pendingKey(ev.kind, ev.index));
      if (ev.item) {
        const key = { statement: 'statements', question: 'questions', switch: 'topicSwitches' }[ev.kind];
        state.result[key][ev.index] = ev.item; render(); toast('새로 만들었어요');
      } else toast(ev.message || '다시 만들지 못했어요');
      break;
    case 'followup-start': $('fuOut').replaceChildren(h('p', { class: 'hint', role: 'status' }, '답변을 만드는 중…')); break;
    case 'followup-error': setFuBusy(false); $('fuOut').replaceChildren(h('div', { class: 'banner error', role: 'alert' }, ev.message)); break;
    case 'followup-result':
      setFuBusy(false);
      // replaceChildren(null)은 "null" 글자를 넣으므로 빈 항목은 걸러낸다.
      $('fuOut').replaceChildren(...[
        h('p', { class: 'hint' }, `질문: ${ev.question}`),
        ev.insufficient ? h('div', { class: 'banner' }, ev.note || '답변을 만들 정보가 부족해요. 무리하게 단정하지 않았어요.') : null,
        h('ul', { class: 'cards' }, ev.answers.map((a) => h('li', {}, h('p', { class: 'text' }, a.text), h('div', { class: 'actions' }, copyBtn(a.text), srcBadges(a.sourceIds))))),
      ].filter(Boolean));
      break;
    default: break;
  }
}

/** 결과 위에 실제로 어떤 AI가 만들었는지 표시한다. */
function showGeneratedBy(id, label) {
  const el = $('genBy');
  el.textContent = id === 'kiro' ? 'Kiro가 만든 결과예요.' : `${label || 'AI'}가 만든 결과예요.`;
  el.className = id === 'kiro' ? 'genBy' : 'genBy other';
}

const KIRO_TEXT = {
  checking: ['Kiro 확인 중…', 'wait'],
  connected: ['Kiro 연결됨', 'ok'],
  not_installed: ['Kiro 미설치', 'bad'],
  not_logged_in: ['Kiro 로그인 필요', 'bad'],
  error: ['Kiro 확인 실패', 'bad'],
};

function renderKiroStatus(k) {
  const [label, cls] = KIRO_TEXT[(k && k.status) || 'checking'] || KIRO_TEXT.error;
  const el = $('kiroStatus');
  el.textContent = label;
  el.className = `conn ${cls}`;
  el.title = (k && k.message) || '';
  $('kiroCheck').hidden = !k || k.status === 'checking';
}

function setBusy(b) { state.busy = b; $('analyze').disabled = b; }

// ---- 뜻 먼저 보기: 전체 결과와 따로, AI가 짧게 답한 한 줄 뜻을 먼저 보여 준다(quick 이벤트) ----
const QUICK_KEY = 'aneuncheok.quickMeaning';
function quickOn() { try { return localStorage.getItem(QUICK_KEY) !== 'off'; } catch { return true; } }
function setQuickOn(on) { try { localStorage.setItem(QUICK_KEY, on ? 'on' : 'off'); } catch { /* 저장 불가면 이번 실행에만 적용 */ } }
function hideQuick() { $('quickCard').hidden = true; }
function showQuick(ev) {
  if (!$('quick').checked || !ev.oneLine) { hideQuick(); return; }
  $('quickText').textContent = ev.oneLine;
  const who = ev.providerId === 'kiro' ? 'Kiro' : (ev.provider || 'AI');
  const badge = $('quickSrc');
  badge.textContent = ev.confidence === 'high' ? `${who} AI 답변 · 출처 없음` : `${who} AI 추정 · 확실하지 않아요`;
  badge.className = ev.confidence === 'high' ? 'badge gen' : 'badge est';
  $('quickCard').hidden = false;
}

function setFuBusy(b) {
  state.fuBusy = b;
  const btn = $('fuBtn');
  btn.disabled = b;
  btn.textContent = b ? '만드는 중…' : '답변 만들기';
}
function showFuMessage(msg) { $('fuOut').replaceChildren(h('div', { class: 'banner', role: 'alert' }, msg)); }

/** 후속 질문은 한 번에 하나만 보낸다(Enter 연타·버튼 중복 클릭 방지). */
async function submitFollowup() {
  const text = $('fuInput').value;
  if (state.fuBusy) return;
  if (!view.canSubmitFollowup({ busy: state.fuBusy, text })) { showFuMessage('상대가 한 질문을 입력해 주세요.'); $('fuInput').focus(); return; }
  const my = ++state.fuSeq;
  setFuBusy(true);
  try { await bridge.followup(text); }
  finally { if (my === state.fuSeq) setFuBusy(false); }
}

// ---- Kiro 로그인 화면 ----
function renderGate(s) {
  const screen = view.pickScreen(s);
  const onGate = screen === 'gate';
  $('gate').hidden = !onGate;
  $('mainView').hidden = onGate;
  $('mainFoot').hidden = onGate;
  if (!onGate) return;
  const g = view.gateView(s);
  $('gateMsg').textContent = g.message;
  $('gateLogin').hidden = g.mode !== 'login';
  $('gateInstall').hidden = g.mode !== 'install';
  $('gateWaiting').hidden = g.mode !== 'waiting';
  $('gateCode').hidden = !g.code;
  $('gateCode').textContent = g.code ? `코드 ${g.code}` : '';
  $('gateOpen').hidden = !g.canOpen;
  $('gateCmd').textContent = (s && s.kiroInstallCommand) || '';
  $('gateRecheck').disabled = g.mode === 'checking' || g.mode === 'waiting';
  $('gateSkip').hidden = g.mode === 'waiting';
}

function applyAppState(s) {
  state.app = s;
  renderGate(s);
  $('auto').checked = s.autoAnalyze;
  $('auto').disabled = !s.autoSupported;
  $('autoLabel').textContent = !s.autoSupported ? '자동 분석: Windows 전용' : s.autoAnalyze ? '자동 분석 켜짐' : '자동 분석 꺼짐';
  const sel = $('provider');
  if (!sel.options.length) {
    const names = { auto: '자동 선택(Kiro 우선)', kiro: 'Kiro CLI', openai: 'OpenAI 호환' };
    s.providers.forEach((p) => sel.append(h('option', { value: p }, names[p])));
  }
  sel.value = s.provider;
  renderKiroStatus(s.kiro);
  if (!state.result) $('providerNote').textContent = `사용 중: ${s.activeProvider.label}${s.activeProvider.external ? '' : ' (외부 전송 없음)'}`;
}

function submit() {
  const text = $('text').value;
  if (!text.trim()) { setNotice('내용을 입력하거나 붙여넣어 주세요.'); $('text').focus(); return; }
  bridge.analyze({ text, tone: tone(), quick: $('quick').checked, note: $('note').value, direction: $('direction').value });
}

$('analyze').addEventListener('click', submit);
$('gateGithub').addEventListener('click', () => bridge.kiroLogin('github'));
$('gateGoogle').addEventListener('click', () => bridge.kiroLogin('google'));
$('gateBuilder').addEventListener('click', () => bridge.kiroLogin('builder'));
$('gateTerminal').addEventListener('click', () => bridge.kiroLogin('terminal'));
$('gateCancel').addEventListener('click', () => bridge.kiroLoginCancel());
$('gateOpen').addEventListener('click', () => bridge.kiroLoginOpen());
$('gateInstallOpen').addEventListener('click', () => bridge.openKiroInstall());
$('gateCmdCopy').addEventListener('click', () => { const c = state.app && state.app.kiroInstallCommand; if (c) copy(c); });
$('gateRecheck').addEventListener('click', () => bridge.checkKiro());
$('gateSkip').addEventListener('click', () => bridge.skipLogin());
// Enter만 누르면 바로 분석, Shift+Enter는 줄바꿈. 분석 중에는 중복 요청하지 않는다.
$('text').addEventListener('keydown', (e) => {
  if (!view.isSubmitKey(e)) return;
  e.preventDefault();
  if (!state.busy) submit();
});
$('retry').addEventListener('click', () => { setError(''); bridge.retry(); });
$('close').addEventListener('click', () => bridge.hide());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') bridge.hide(); });
$('auto').addEventListener('change', async (e) => { const on = await bridge.setAuto(e.target.checked); e.target.checked = Boolean(on); });
$('provider').addEventListener('change', (e) => bridge.setProvider(e.target.value));
$('quick').checked = quickOn();
bridge.setQuick($('quick').checked);
$('quick').addEventListener('change', (e) => { setQuickOn(e.target.checked); bridge.setQuick(e.target.checked); if (!e.target.checked) hideQuick(); });
$('kiroCheck').addEventListener('click', () => bridge.checkKiro());
document.querySelectorAll('input[name=tone]').forEach((r) => r.addEventListener('change', () => { if (state.result) bridge.setTone(tone()); }));
$('fuBtn').addEventListener('click', submitFollowup);
$('fuInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitFollowup(); } });

bridge.onEvent(onEvent);
bridge.onState(applyAppState);
bridge.onIncoming(({ text }) => { $('text').value = text; });
bridge.getState().then((s) => { applyAppState(s); setTone(s.tone); });