import type { Question, Quiz, Round, Slide, Topic } from './types';

const QUESTIONS_PER_TOPIC = 5;
const TOPICS_PER_ROUND = 2;
const ROUND_COUNT = 5;

export function createId(): string {
  return crypto.randomUUID();
}

function emptyQuestion(): Question {
  return {
    id: createId(),
    enabled: false,
    type: 'text',
    prompt: '',
    answer: '',
    notes: '',
    sources: [],
    media: null,
    mediaHint: '',
  };
}

function emptyTopic(roundIndex: number, topicIndex: number): Topic {
  return {
    title: `Téma ${roundIndex * TOPICS_PER_ROUND + topicIndex + 1}`,
    subtitle: '',
    enabled: false,
    questions: [],
  };
}

function emptyRound(index: number): Round {
  return { title: `${index + 1}. kolo`, topics: [] };
}

/** Restores the fixed 5 × 2 × 5 editor structure used by the original app. */
export function normalizeQuiz(quiz: Quiz): Quiz {
  quiz.rounds ??= [];
  while (quiz.rounds.length < ROUND_COUNT) quiz.rounds.push(emptyRound(quiz.rounds.length));
  quiz.rounds = quiz.rounds.slice(0, ROUND_COUNT);

  quiz.rounds.forEach((round, roundIndex) => {
    round.title ||= `${roundIndex + 1}. kolo`;
    round.topics ??= [];
    while (round.topics.length < TOPICS_PER_ROUND) {
      round.topics.push(emptyTopic(roundIndex, round.topics.length));
    }
    round.topics = round.topics.slice(0, TOPICS_PER_ROUND);

    round.topics.forEach((topic) => {
      topic.enabled = topic.enabled !== false;
      topic.questions ??= [];
      while (topic.questions.length < QUESTIONS_PER_TOPIC) topic.questions.push(emptyQuestion());
      topic.questions = topic.questions.slice(0, QUESTIONS_PER_TOPIC);
      topic.questions.forEach((question) => {
        question.id ||= createId();
        question.enabled = question.enabled !== false;
        question.type ||= 'text';
        question.sources ??= [];
      });
    });
  });

  quiz.settings ??= { questionsPerTopic: QUESTIONS_PER_TOPIC, countdownSeconds: 60 };
  return quiz;
}

export function buildSlides(quiz: Quiz): Slide[] {
  const slides: Slide[] = [{ kind: 'intro' }];

  quiz.rounds.forEach((round, roundIndex) => {
    round.topics.forEach((topic, topicIndex) => {
      if (!topic.enabled) return;

      slides.push({ kind: 'topic', round, roundIndex, topic, topicIndex });
      topic.questions
        .filter((question) => question.enabled && question.prompt.trim())
        .forEach((question, questionIndex) => {
          slides.push({ kind: 'question', round, roundIndex, topic, topicIndex, question, questionIndex });
        });
    });
    slides.push({ kind: 'countdown', round, roundIndex });
  });

  slides.push({ kind: 'final' });
  return slides;
}

export function activeQuestionCount(topic: Topic): number {
  return topic.questions.filter((question) => question.enabled && question.prompt.trim()).length;
}

export function mediaUrl(media: Question['media']): string {
  if (!media) return '';
  return media.kind === 'stored' ? `/api/media/${encodeURIComponent(media.id ?? '')}` : (media.url ?? '');
}
