'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeResult, normalizeAnswers, extractJson } = require('../../src/ai/schema');

const sources = [{ id: 'S1' }, { id: 'S2' }];

test('extractJson: 코드블록·설명이 섞여도 JSON을 추출한다', () => {
  assert.deepEqual(extractJson('설명\n```json\n{"a":{"b":"}"}}\n```\n끝'), { a: { b: '}' } });
  assert.deepEqual(extractJson('앞말 {"x":1} 뒷말'), { x: 1 });
  assert.throws(() => extractJson('JSON 없음'));
  assert.throws(() => extractJson('{"a":'));
});

test('모델이 만든 가짜 출처 ID는 제거하고 basis를 general로 낮춘다', () => {
  const r = normalizeResult({ statements: [{ text: '문장', basis: 'sourced', sourceIds: ['S9'] }] }, sources);
  assert.equal(r.statements[0].basis, 'general');
  assert.deepEqual(r.statements[0].sourceIds, []);
});

test('유효한 출처 ID는 유지한다', () => {
  const r = normalizeResult({ statements: [{ text: '문장', basis: 'sourced', sourceIds: ['S1', 'S1', 'x'] }] }, sources);
  assert.equal(r.statements[0].basis, 'sourced');
  assert.deepEqual(r.statements[0].sourceIds, ['S1']);
});

test('출처 없는 keyFacts는 노출하지 않는다', () => {
  const r = normalizeResult({ keyFacts: [{ text: '사실', sourceIds: [] }, { text: '확인', sourceIds: ['S2'] }] }, sources);
  assert.equal(r.keyFacts.length, 1);
});

test('예상 질문은 항상 AI 추정(estimated)으로 표시하고, 답변 없는 질문은 제외한다', () => {
  const r = normalizeResult({ questions: [{ question: 'Q1', answers: [{ text: 'A' }] }, { question: 'Q2', answers: [] }] }, sources);
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].estimated, true);
});

test('목표 개수에 못 미치면 shortfalls로 알리고 채우지 않는다', () => {
  const r = normalizeResult({ statements: [{ text: 'a' }] }, sources);
  assert.equal(r.statements.length, 1);
  assert.ok(r.shortfalls.length >= 3);
});

test('잘못된 입력에도 예외 없이 빈 결과를 돌려준다', () => {
  for (const bad of [null, undefined, 'x', 3, { statements: 'x', questions: {} }]) {
    const r = normalizeResult(bad, sources);
    assert.equal(r.statements.length, 0);
  }
});

test('후속 답변: 비어 있으면 insufficient', () => {
  assert.equal(normalizeAnswers({ answers: [] }).insufficient, true);
  assert.equal(normalizeAnswers({ answers: [{ text: '답' }] }).insufficient, false);
});

const { supportScore, SUPPORT_MIN } = require('../../src/ai/schema');
const { createFakeProvider } = require('../fixtures/fakeProvider');

const realSources = [
  { id: 'S1', title: '양자 컴퓨터', extract: '양자 컴퓨터는 양자역학의 중첩과 얽힘을 이용해 계산하는 컴퓨터이다. 특정 문제에서 기존 컴퓨터보다 빠를 수 있다.' },
  { id: 'S2', title: '비트코인', extract: '비트코인은 2009년에 공개된 암호화폐이다. 블록체인 기술을 기반으로 한다.' },
];

test('supportScore: 출처와 겹치는 문장은 높고 무관한 문장은 낮다', () => {
  assert.ok(supportScore('양자 컴퓨터는 중첩과 얽힘을 써서 계산한대요.', realSources[0].extract) >= SUPPORT_MIN);
  assert.ok(supportScore('올해 프로야구 우승팀은 어디일까요?', realSources[0].extract) < SUPPORT_MIN);
  assert.equal(supportScore('', 'x'), 0);
});

test('내용이 출처와 맞지 않으면 출처 연결을 끊고 general로 낮춘다', () => {
  const r = normalizeResult({
    statements: [
      { text: '양자 컴퓨터는 중첩과 얽힘을 이용해서 계산한대요.', basis: 'sourced', sourceIds: ['S1'] },
      { text: '양자 컴퓨터는 2009년에 처음으로 상용화되었다고 하더라고요.', basis: 'sourced', sourceIds: ['S2'] },
      { text: '프로야구 결승전 표가 매진됐대요.', basis: 'sourced', sourceIds: ['S1'] },
    ],
  }, realSources);
  assert.deepEqual(r.statements.map((s) => s.basis), ['sourced', 'general', 'general']);
  assert.deepEqual(r.statements[2].sourceIds, []);
});

test('여러 출처 중 실제로 뒷받침하는 출처만 남긴다', () => {
  const r = normalizeResult({ keyFacts: [{ text: '비트코인은 블록체인 기술을 기반으로 한 암호화폐다', sourceIds: ['S1', 'S2'] }] }, realSources);
  assert.deepEqual(r.keyFacts[0].sourceIds, ['S2']);
});

test('뒷받침되지 않는 핵심 정보와 후속 답변 출처는 제거한다', () => {
  const r = normalizeResult({ keyFacts: [{ text: '화성에는 도시가 세 곳 있다', sourceIds: ['S1'] }] }, realSources);
  assert.equal(r.keyFacts.length, 0);
  const a = normalizeAnswers({ answers: [{ text: '화성에는 도시가 세 곳 있어요', sourceIds: ['S1'] }] }, realSources);
  assert.deepEqual(a.answers[0].sourceIds, []);
});

test('출처 문장을 그대로 인용한 문장은 검증에서 강등되지 않는다', async () => {
  const raw = await createFakeProvider().generate({ ctx: { text: '양자 컴퓨터', tone: 'casual', sources: realSources }, kind: 'full' });
  const r = normalizeResult(JSON.parse(raw), realSources);
  assert.equal(r.statements.filter((s) => s.basis === 'sourced').length, 3);
  assert.equal(r.keyFacts.length, 3);
});

test('terms: 뜻 없는 항목과 중복을 버리고, 확신도는 high만 인정하며, 최대 5개', () => {
  const { MAX_TERMS } = require('../../src/ai/schema');
  const r = normalizeResult({
    terms: [
      { term: '치이카와', meaning: '일본 작가 나가노의 캐릭터 만화', inThisText: '캐릭터 이름', confidence: 'high' },
      { term: '치이카와', meaning: '중복' },
      { term: '토벌', meaning: '작품 속 캐릭터들이 돈을 벌려고 하는 일', confidence: 'sure' },
      { term: '빈뜻', meaning: '' },
      null, 'x',
      ...Array.from({ length: 8 }, (_, i) => ({ term: `t${i}`, meaning: 'm' })),
    ],
  });
  assert.equal(r.terms.length, MAX_TERMS);
  assert.deepEqual(r.terms.slice(0, 2).map((t) => [t.term, t.confidence]), [['치이카와', 'high'], ['토벌', 'low']]);
  assert.equal(r.terms[0].inThisText, '캐릭터 이름');
  assert.equal(r.terms[1].origin, '');
  assert.deepEqual(normalizeResult({}).terms, []);
});

test('normalizeQuick: 한 줄 뜻이 없으면 null, 확신도는 high만 인정, 200자 제한', () => {
  const { normalizeQuick } = require('../../src/ai/schema');
  assert.equal(normalizeQuick({}), null);
  assert.equal(normalizeQuick({ oneLine: '   ' }), null);
  assert.equal(normalizeQuick(null), null);
  assert.deepEqual(normalizeQuick({ oneLine: ' 운이 좋다는 밈이에요 ', confidence: 'high' }), { oneLine: '운이 좋다는 밈이에요', confidence: 'high' });
  assert.equal(normalizeQuick({ oneLine: 'x', confidence: 'sure' }).confidence, 'low');
  assert.equal(normalizeQuick({ oneLine: 'x'.repeat(300) }).oneLine.length, 200);
});

test('terms: 예문(example)을 150자까지 남기고 없으면 빈 문자열', () => {
  const r = normalizeResult({ terms: [{ term: '럭키비키', meaning: '긍정적으로 받아들이는 말', example: '비 와서 쉬는 날이네, 완전 럭키비키잖아' }, { term: 'x', meaning: 'y', example: 'z'.repeat(200) }, { term: 'a', meaning: 'b' }] });
  assert.equal(r.terms[0].example, '비 와서 쉬는 날이네, 완전 럭키비키잖아');
  assert.equal(r.terms[1].example.length, 150);
  assert.equal(r.terms[2].example, '');
});

test('extractJson: 실측에서 나온 따옴표 없는 문자열 값은 파싱 오류로 거부한다', () => {
  assert.throws(() => extractJson('{"questions":[{"question":같이 갈래요?,"answers":[]}]}'));
});

test('terms: 출처가 뜻풀이를 뒷받침할 때만 출처 연결을 남긴다', () => {
  const r = normalizeResult({
    terms: [
      { term: '양자 컴퓨터', meaning: '양자역학의 중첩과 얽힘을 이용해 계산하는 컴퓨터', sourceIds: ['S1'] },
      { term: '토벌', meaning: '캐릭터들이 몬스터를 잡아 돈을 버는 일', sourceIds: ['S1', 'S9'] },
    ],
  }, realSources);
  assert.deepEqual(r.terms[0].sourceIds, ['S1']);
  assert.deepEqual(r.terms[1].sourceIds, []);
});

test('normalizeResult: 모델이 파악한 context를 200자까지 남기고, 없으면 빈 문자열', () => {
  assert.equal(normalizeResult({ context: '  팀 회의에서 동료가 OKR 도입을 꺼낸 상황  ' }).context, '팀 회의에서 동료가 OKR 도입을 꺼낸 상황');
  assert.equal(normalizeResult({ context: 'x'.repeat(300) }).context.length, 200);
  assert.equal(normalizeResult({}).context, '');
  assert.equal(normalizeResult({ context: 42 }).context, '');
});
