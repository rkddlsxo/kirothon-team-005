'use strict';
// 테스트 전용 가짜 공급자. 외부 AI 없이 검색 자료 문장을 인용한 고정 형식의 JSON을 돌려준다.
// 앱에는 포함하지 않는다. 서비스 흐름(이벤트 순서, 재생성, 후속 질문)과 정규화 검증을 네트워크 없이 시험하는 데만 쓴다.

function sentences(text) {
  return String(text || '').replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/).map((s) => s.trim()).filter((s) => s.length >= 12 && s.length <= 160);
}

const HEDGE = '정확한 건 더 찾아봐야 알 것 같아요.';
const SWITCHES = [
  { topic: '근황', line: '그나저나 요즘 어떻게 지내요?' },
  { topic: '주말 계획', line: '아, 그러고 보니 이번 주말에는 뭐 해요?' },
  { topic: '최근 본 콘텐츠', line: '혹시 요즘 재미있게 본 거 있어요?' },
];

function createFakeProvider() {
  return {
    id: 'fake',
    label: '테스트용 가짜 공급자',
    external: false,
    async generate({ ctx, kind, avoid = [] }) {
      if (kind === 'quick') return JSON.stringify({ oneLine: `${String(ctx.text).slice(0, 20)}에 대한 한 줄 뜻`, confidence: 'high' });
      const topic = String(ctx.topicHint || ctx.text).slice(0, 20);
      const cites = [];
      for (const s of ctx.sources || []) for (const sent of sentences(s.extract)) cites.push({ sent, id: s.id });
      const hasSrc = cites.length > 0;
      const pick = (i) => cites[i % Math.max(cites.length, 1)];
      const cite = (s) => `자료를 보니 "${s}"라고 하더라고요.`;

      if (kind === 'followup') {
        if (!hasSrc) return JSON.stringify({ answers: [], insufficient: true, note: '검색된 자료가 없어요.' });
        const answers = [0, 1, 2].slice(0, Math.min(3, cites.length)).map((i) => ({ text: cite(pick(i).sent), sourceIds: [pick(i).id] }));
        answers.push({ text: HEDGE, sourceIds: [] });
        return JSON.stringify({ answers, insufficient: false, note: '' });
      }

      const statements = cites.slice(0, 3).map((c) => ({ text: cite(c.sent), basis: 'sourced', sourceIds: [c.id] }));
      statements.push({ text: `${topic} 얘기 요즘 자주 들리더라고요.`, basis: 'general', sourceIds: [] });
      statements.push({ text: `${topic}, 저도 궁금했어요.`, basis: 'general', sourceIds: [] });
      statements.push({ text: `${topic}에 대해 어떻게 생각해요?`, basis: 'general', sourceIds: [] });
      const two = (a) => [a, { text: HEDGE, sourceIds: [] }];
      const questions = [
        { question: `${topic}이(가) 정확히 뭐예요?`, answers: two(hasSrc ? { text: cite(pick(0).sent), sourceIds: [pick(0).id] } : { text: '같이 찾아봐도 좋겠어요.', sourceIds: [] }) },
        { question: '그건 언제부터 그랬어요?', answers: two({ text: '시점은 확인이 필요해 보여요.', sourceIds: [] }) },
        { question: '왜 그렇게 된 거예요?', answers: two({ text: '이유는 여러 가지라고 하더라고요.', sourceIds: [] }) },
        { question: '관심 있어요?', answers: two({ text: '조금씩 알아보는 중이에요.', sourceIds: [] }) },
        { question: '어떻게 생각해요?', answers: two({ text: '장단점이 다 있어 보여요.', sourceIds: [] }) },
      ];
      const switches = SWITCHES.map((s) => ({ ...s, sourceIds: [] }));

      if (kind === 'statement' || kind === 'question' || kind === 'switch') {
        const pool = kind === 'statement' ? statements : kind === 'question' ? questions : switches;
        const key = kind === 'statement' ? 'statements' : kind === 'question' ? 'questions' : 'topicSwitches';
        const fresh = pool.filter((it) => !avoid.includes(it.text || it.question || it.line));
        return JSON.stringify({ [key]: fresh.length ? [fresh[0]] : [] });
      }
      return JSON.stringify({
        context: '테스트용 고정 맥락', topic,
        keyFacts: cites.slice(0, 3).map((c) => ({ text: c.sent, sourceIds: [c.id] })),
        statements, questions, topicSwitches: switches,
      });
    },
  };
}

module.exports = { createFakeProvider };
