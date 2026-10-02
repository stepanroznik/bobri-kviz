import type { Question, Quiz, Round, Slide, Topic } from './types';

const RECOMMENDED_QUESTIONS_PER_TOPIC = 5;
const RECOMMENDED_TOPICS_PER_ROUND = 2;

export function createId(): string {
  return crypto.randomUUID();
}

export function createQuestion(): Question {
  return {
    id: createId(), enabled: false, type: 'text', prompt: '', answer: '', notes: '', sources: [], media: null, mediaHint: '',
  };
}

export function createTopic(topicNumber: number): Topic {
  return { title: `Téma ${topicNumber}`, subtitle: '', enabled: false, questions: [] };
}

export function createRound(roundNumber: number): Round {
  return { title: `${roundNumber}. kolo`, topics: [] };
}

/** Supplies missing legacy values, but deliberately never adds or removes quiz content. */
export function normalizeQuiz(quiz: Quiz): Quiz {
  quiz.rounds ??= [];
  quiz.rounds.forEach((round, roundIndex) => {
    round.title ||= `${roundIndex + 1}. kolo`;
    round.topics ??= [];
    round.topics.forEach((topic, topicIndex) => {
      topic.title ||= `Téma ${topicIndex + 1}`;
      topic.subtitle ??= '';
      topic.enabled = topic.enabled !== false;
      topic.questions ??= [];
      topic.questions.forEach((question) => {
        question.id ||= createId();
        question.enabled = question.enabled !== false;
        question.type ||= 'text';
        question.prompt ??= '';
        question.answer ??= '';
        question.notes ??= '';
        question.sources ??= [];
        question.media ??= null;
        question.mediaHint ??= '';
      });
    });
  });
  quiz.settings ??= { questionsPerTopic: RECOMMENDED_QUESTIONS_PER_TOPIC, countdownSeconds: 60 };
  return quiz;
}

export function buildSlides(quiz: Quiz): Slide[] {
  const slides: Slide[] = [{ kind: 'intro' }];
  quiz.rounds.forEach((round, roundIndex) => {
    round.topics.forEach((topic, topicIndex) => {
      slides.push({ kind: 'topic', round, roundIndex, topic, topicIndex });
      topic.questions.filter((question) => question.prompt.trim()).forEach((question, questionIndex) => {
        slides.push({ kind: 'question', round, roundIndex, topic, topicIndex, question, questionIndex });
      });
    });
    slides.push({ kind: 'countdown', round, roundIndex });
  });
  slides.push({ kind: 'final' });
  return slides;
}

export function activeQuestionCount(topic: Topic): number {
  return topic.questions.filter((question) => question.prompt.trim()).length;
}

/** Normalizes pasted line endings for display without changing the stored text. */
export function formatQuestionPrompt(prompt: string): string {
  return prompt.replace(/\r\n|[\r\v\f\u0085\u2028\u2029]/g, '\n');
}

export function mediaUrl(media: Question['media']): string {
  if (!media) return '';
  return media.kind === 'stored' ? `/api/media/${encodeURIComponent(media.id ?? '')}` : (media.url ?? '');
}
