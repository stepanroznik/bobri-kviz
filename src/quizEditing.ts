import type { Question, Quiz, Round, Topic } from './types';

/** Moves the existing object, including its questions and media, to the destination's end. */
export function moveTopic(quiz: Quiz, topic: Topic, destination: Round): boolean {
  if (!quiz.rounds.includes(destination)) return false;
  const source = quiz.rounds.find((round) => round.topics.includes(topic));
  if (!source || source === destination) return false;

  source.topics.splice(source.topics.indexOf(topic), 1);
  destination.topics.push(topic);
  return true;
}

/** Validates both containers before removing anything from the source. */
export function moveQuestion(quiz: Quiz, question: Question, destination: Topic): boolean {
  const topics = quiz.rounds.flatMap((round) => round.topics);
  if (!topics.includes(destination)) return false;
  const source = topics.find((topic) => topic.questions.includes(question));
  if (!source || source === destination) return false;

  source.questions.splice(source.questions.indexOf(question), 1);
  destination.questions.push(question);
  return true;
}
