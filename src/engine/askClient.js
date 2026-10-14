const ENDPOINT = '/api/ask';
const TIMEOUT_MS = 22000;

export const ASK_LIMIT_PER_TOPIC = 2;

export function normaliseAskQuestion(value) {
  return String(value || '').normalize('NFKD').toLocaleLowerCase('en')
    .replace(/[’‘'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function suggestedQuestions(disciplineId) {
  const byDiscipline = {
    influence: [
      { label: 'Spot it in real life', question: 'How might this technique show up in an everyday situation?' },
      { label: 'Protect yourself', question: 'How can I recognise or respond to this technique without escalating the situation?' },
      { label: 'When does it fail?', question: 'When might this technique not work, or when would it be a poor explanation?' },
    ],
    psychology: [
      { label: 'Everyday example', question: 'Can you give me a different everyday example of this effect?' },
      { label: 'Common misconception', question: 'What do people often misunderstand about this effect?' },
      { label: 'Limits and exceptions', question: 'When might this effect not apply?' },
    ],
    scale: [
      { label: 'Put it in perspective', question: 'Can you compare this with a familiar number or real-world scale?' },
      { label: 'Show the maths', question: 'Can you show the simple calculation behind this comparison?' },
      { label: 'What is uncertain?', question: 'Which parts are estimates, and what are the main limitations?' },
    ],
    principles: [
      { label: 'Put it to use', question: 'How could I apply this principle to a real decision?' },
      { label: 'See another example', question: 'Can you give me a different practical example?' },
      { label: 'Where it fails', question: 'When could this principle mislead someone?' },
    ],
    practical: [
      { label: 'Walk me through it', question: 'Can you turn this into simple steps I can follow?' },
      { label: 'Avoid mistakes', question: 'What are the most common mistakes or warning signs?' },
      { label: 'Safety check', question: 'What should I check before trying this, and when should I call a professional?' },
    ],
    'hidden-systems': [
      { label: 'Follow the incentives', question: 'Who benefits from this system, and what incentives shape their behaviour?' },
      { label: 'Real-world example', question: 'Can you give me a concrete example of this system at work?' },
      { label: 'Second-order effects', question: 'What unintended consequences can this system create?' },
    ],
    money: [
      { label: 'Use a real example', question: 'Can you walk through a realistic example with numbers?' },
      { label: 'Spot the risks', question: 'What are the main risks and trade-offs to understand here?' },
      { label: 'Before I decide', question: 'What should someone check before making a decision like this?' },
    ],
    maths: [
      { label: 'Show each step', question: 'Can you show another example and explain each step?' },
      { label: 'Avoid mistakes', question: 'What is the most common mistake when using this technique?' },
      { label: 'When to use it', question: 'When is this technique useful, and when is another method better?' },
    ],
    traps: [
      { label: 'Compare the answers', question: 'Why is the best answer stronger than the other options?' },
      { label: 'New scenario', question: 'Can you give me a different scenario that uses the same reasoning trap?' },
      { label: 'Spot it faster', question: 'What clue should I look for to recognise this next time?' },
    ],
    fallacies: [
      { label: 'Compare the answers', question: 'Why is the best answer stronger than the other options?' },
      { label: 'New scenario', question: 'Can you give me a different example of this reasoning error?' },
      { label: 'Spot it faster', question: 'What clue helps distinguish this fallacy from similar ones?' },
    ],
    rebus: [
      { label: 'Explain the clue', question: 'Can you walk me through how the visual clue leads to the answer?' },
      { label: 'Why this answer?', question: 'Why does this answer fit better than another interpretation?' },
      { label: 'Learn the pattern', question: 'What common rebus pattern does this puzzle use?' },
    ],
    court: [
      { label: 'Explain the ruling', question: 'How do the facts support the ruling in this case?' },
      { label: 'Test another outcome', question: 'What change to the facts might reasonably change the outcome?' },
      { label: 'Compare both sides', question: 'What is the strongest argument for each side?' },
    ],
  };
  return byDiscipline[disciplineId] || [
    { label: 'Explain it simply', question: 'Can you explain this in simpler words?' },
    { label: 'Give another example', question: 'Can you give me a different real-life example?' },
    { label: 'What are the limits?', question: 'What are the main limitations or exceptions?' },
  ];
}

export function askErrorMessage(code) {
  const messages = {
    offline: 'You appear to be offline. Reconnect and try again.',
    bad_request: 'Please enter a clear question about this topic.',
    question_private_info: 'Please remove personal details or private credentials. Questions and answers can be shared with other readers.',
    topic_unavailable: 'This topic is no longer available. Return to the library and open it again.',
    database_unconfigured: 'Questions are temporarily unavailable. Please try again later.',
    ai_unconfigured: 'Answers are temporarily unavailable. Please try again later.',
    quota_exhausted: 'The question limit for this topic has been reached for today. You can still read answers already in the shared library.',
    ai_busy: 'The AI service is busy. Try again later.',
    ai_timeout: 'The answer took too long to arrive. Check your connection and try again.',
    ai_bad_output: 'The answer could not be checked. Please try a different question later.',
    database_permissions: 'We could not save this answer for other readers. Please try again later.',
    database_schema_error: 'Questions are temporarily unavailable. Please try again later.',
    database_unavailable: 'Shared answers are temporarily unavailable. Please try again later.',
    service_error: 'The question could not be completed. Check your connection and try again.',
  };
  return messages[code] || messages.service_error;
}

export async function askAboutTopic({ disciplineId, topic, question }, { signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ disciplineId, topic, question }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || (response.status === 429 ? 'quota_exhausted' : 'service_error'));
    if (typeof payload.answer !== 'string' || payload.answer.trim().length < 20) throw new Error('service_error');
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message && !['AbortError', 'TimeoutError'].includes(error.name)) throw error;
    if (signal?.aborted) throw new Error('cancelled');
    throw new Error(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'ai_timeout');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
