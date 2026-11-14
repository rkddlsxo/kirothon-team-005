'use strict';
// 분석 파이프라인: 검증 -> 검색 -> 생성 -> 정규화. 요청 ID로 오래된 응답이 새 결과를 덮어쓰지 못하게 한다.
const { validateInput } = require('./textGuard');
const { searchTopic } = require('../ai/search');
const prompt = require('../ai/prompt');
const { normalizeResult, normalizeAnswers, normalizeQuick, extractJson } = require('../ai/schema');

function createService({ getProvider, search = searchTopic, emit = () => {} }) {
  let seq = 0;            // 요청 ID (새 분석마다 증가)
  let ctrl = null;        // 진행 중 요청 취소용
  let session = null;     // 마지막 분석 컨텍스트
  const aux = new Set();  // 재생성/후속 질문 요청 취소용

  const isCurrent = (id) => id === seq;
  const send = (id, event) => { if (isCurrent(id)) emit({ requestId: id, ...event }); };
  const errMsg = (e) => (e && e.message) || String(e);

  function begin() {
    if (ctrl) ctrl.abort();
    aux.forEach((c) => c.abort());
    aux.clear();
    ctrl = new AbortController();
    seq += 1;
    return { id: seq, signal: ctrl.signal };
  }

  /** 모델 호출 후 JSON 추출. 실측에서 가끔 깨진 JSON이 나와, 파싱에 실패하면 한 번만 다시 호출한다. */
  async function callModel(ctx, promptText, extra, signal, provider = getProvider()) {
    for (let attempt = 1; ; attempt++) {
      const raw = await provider.generate({ prompt: promptText, signal, ctx, ...extra });
      try {
        return extractJson(raw);
      } catch (e) {
        if (attempt >= 2 || (signal && signal.aborted)) throw e;
      }
    }
  }

  async function generateFull(id, signal) {
    const provider = getProvider();   // 결과에 표시할 공급자는 실제로 호출한 공급자와 같아야 한다
    send(id, { type: 'stage', stage: 'generating', providerId: provider.id, provider: provider.label });
    try {
      const json = await callModel(session, prompt.buildFullPrompt(session), { kind: 'full' }, signal, provider);
      const result = normalizeResult(json, session.sources);
      session.result = result;
      session.topicHint = result.topic || session.topicHint;
      const hint = [result.context, ...(result.terms || []).map((t) => `${t.term}: ${t.inThisText || t.meaning}`)].filter(Boolean).join(' / ');
      session.contextHint = hint.slice(0, 400) || session.contextHint;
      if (!result.statements.length && !result.questions.length && !result.topicSwitches.length) {
        send(id, { type: 'error', stage: 'generating', message: '생성된 내용이 없어요. 다시 시도해 주세요.', retryable: true });
        return;
      }
      send(id, { type: 'result', result, provider: provider.label, providerId: provider.id });
      send(id, { type: 'stage', stage: 'done' });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      send(id, { type: 'error', stage: 'generating', message: `응답 생성에 실패했어요. ${errMsg(e)}`, retryable: true });
    }
  }

  /**
   * 한 줄 뜻: 검색·전체 생성과 동시에 짧은 프롬프트로 AI에 따로 묻는다. 실패해도 전체 흐름에는 영향이 없다.
   * 새 분석이 시작되면 같은 signal로 취소되고, 늦게 온 응답은 send()가 버린다.
   */
  async function quickMeaning(id, signal) {
    const provider = getProvider();
    try {
      const json = await callModel(session, prompt.buildQuickPrompt(session), { kind: 'quick' }, signal, provider);
      const q = normalizeQuick(json);
      if (q) send(id, { type: 'quick', ...q, provider: provider.label, providerId: provider.id });
    } catch { /* 한 줄 뜻은 보조 정보라 실패를 따로 알리지 않는다 */ }
  }

  async function analyze(rawText, { tone = 'casual', note = '', direction = '', quick = true } = {}) {
    const v = validateInput(rawText);
    if (!v.ok) { emit({ requestId: seq, type: 'invalid', ...v }); return { ok: false, ...v }; }
    const { id, signal } = begin();
    session = { text: v.text, tone: prompt.toneOf(tone), note: String(note).slice(0, 300), direction: String(direction).slice(0, 80), sources: [], searchStatus: 'pending', result: null, topicHint: '', contextHint: '' };
    send(id, { type: 'start', text: v.text, tone: session.tone });
    send(id, { type: 'stage', stage: 'searching' });
    // 기다리지 않는다: 한 줄 뜻은 보조 정보라 analyze의 완료를 늦추지 않는다(오류는 quickMeaning 안에서 삼킨다).
    if (quick) quickMeaning(id, signal);
    let found;
    try {
      found = await search(session.note ? `${v.text} ${session.note}` : v.text, { signal });
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: true, requestId: id };
      found = { status: 'failed', sources: [], error: errMsg(e), retrievedAt: new Date().toISOString() };
    }
    if (!isCurrent(id)) return { ok: true, requestId: id };
    session.sources = found.sources || [];
    session.searchStatus = found.status;
    session.query = found.query;
    send(id, { type: 'sources', status: found.status, sources: session.sources, error: found.error, retrievedAt: found.retrievedAt });
    // 검색 실패/부족이어도 생성은 진행하되, 출처 없는 내용은 사실로 표시하지 않는다(스키마에서 강제).
    await generateFull(id, signal);
    return { ok: true, requestId: id };
  }

  /** 마지막 단계만 다시 시도: 검색 실패면 검색부터, 아니면 생성만 */
  async function retry() {
    if (!session) return { ok: false, message: '다시 시도할 요청이 없어요.' };
    const { text, tone, note, direction } = session;
    if (session.searchStatus === 'ok' && !session.result) {
      const { id, signal } = begin();
      send(id, { type: 'start', text, tone });
      send(id, { type: 'sources', status: 'ok', sources: session.sources });
      await generateFull(id, signal);
      return { ok: true, requestId: id };
    }
    return analyze(text, { tone, note, direction });
  }

  async function changeTone(tone) {
    if (!session) return { ok: false, message: '먼저 텍스트를 분석해 주세요.' };
    session.tone = prompt.toneOf(tone);
    const { id, signal } = begin();
    send(id, { type: 'start', text: session.text, tone: session.tone });
    send(id, { type: 'sources', status: session.searchStatus, sources: session.sources });
    await generateFull(id, signal);
    return { ok: true, requestId: id };
  }

  /** 부분 재생성: kind = statement | question | switch, index = 교체할 위치 */
  async function regenerate(kind, index, direction = '') {
    if (!session || !session.result) return { ok: false, message: '재생성할 결과가 없어요.' };
    const listKey = { statement: 'statements', question: 'questions', switch: 'topicSwitches' }[kind];
    if (!listKey) return { ok: false, message: '알 수 없는 항목이에요.' };
    const list = session.result[listKey];
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return { ok: false, message: '잘못된 위치예요.' };
    const id = seq;                       // 새 분석이 시작되면 폐기
    const auxCtrl = new AbortController();
    aux.add(auxCtrl);
    const signal = auxCtrl.signal;
    const avoid = list.map((it) => it.text || it.question || it.line);
    const ctx = { ...session, direction: direction ? String(direction).slice(0, 80) : session.direction };
    send(id, { type: 'regenerating', kind, index });
    try {
      const json = await callModel(ctx, prompt.buildRegeneratePrompt(ctx, kind, avoid), { kind, avoid }, signal);
      const fresh = normalizeResult({ [listKey]: json[listKey] }, session.sources)[listKey][0];
      if (!isCurrent(id)) return { ok: true };
      if (!fresh) { send(id, { type: 'regenerated', kind, index, item: null, message: '새로 만들 내용이 부족해요.' }); return { ok: true }; }
      list[index] = fresh;
      send(id, { type: 'regenerated', kind, index, item: fresh });
      return { ok: true };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: true };
      send(id, { type: 'regenerated', kind, index, item: null, message: `다시 만들지 못했어요. ${errMsg(e)}` });
      return { ok: false };
    }
  }

  /** 실제로 받은 후속 질문에 대한 답변 */
  async function followup(question) {
    if (!session) return { ok: false, message: '먼저 텍스트를 분석해 주세요.' };
    const q = validateInput(question, 300);
    if (!q.ok) { emit({ requestId: seq, type: 'invalid', ...q, scope: 'followup' }); return { ok: false, ...q }; }
    const id = seq;
    const auxCtrl = new AbortController();
    aux.add(auxCtrl);
    const signal = auxCtrl.signal;
    send(id, { type: 'followup-start', question: q.text });
    try {
      const json = await callModel(session, prompt.buildFollowupPrompt(session, q.text, session.topicHint, session.contextHint), { kind: 'followup', question: q.text }, signal);
      const out = normalizeAnswers(json, session.sources);
      send(id, { type: 'followup-result', question: q.text, ...out });
      return { ok: true };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: true };
      send(id, { type: 'followup-error', question: q.text, message: `답변을 만들지 못했어요. ${errMsg(e)}` });
      return { ok: false };
    }
  }

  function cancel() { if (ctrl) ctrl.abort(); aux.forEach((c) => c.abort()); aux.clear(); seq += 1; }
  function getSession() { return session; }

  return { analyze, retry, changeTone, regenerate, followup, cancel, getSession, _currentId: () => seq };
}

module.exports = { createService };