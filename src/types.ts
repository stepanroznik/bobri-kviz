export type QuestionType = 'text' | 'image' | 'audio';

export interface Media {
  kind: 'stored' | 'external';
  id?: string;
  name?: string;
  mime?: string;
  url?: string;
}

export interface Source {
  label: string;
  url: string;
}

export interface Question {
  id: string;
  enabled: boolean;
  type: QuestionType;
  prompt: string;
  answer: string;
  notes: string;
  sources: Source[];
  media: Media | null;
  mediaHint: string;
  /** Non-destructive playback range in seconds; omitted end means the whole remainder. */
  audioStart?: number;
  audioEnd?: number;
}

export interface Topic {
  title: string;
  subtitle: string;
  enabled: boolean;
  questions: Question[];
}

export interface Round {
  title: string;
  topics: Topic[];
}

export interface QuizSettings {
  questionsPerTopic: number;
  countdownSeconds: number;
}

export interface Quiz {
  title: string;
  subtitle: string;
  rounds: Round[];
  settings: QuizSettings;
  _updatedAt?: string;
}

export type Slide =
  | { kind: 'intro' }
  | { kind: 'final' }
  | { kind: 'topic'; round: Round; roundIndex: number; topic: Topic; topicIndex: number }
  | { kind: 'question'; round: Round; roundIndex: number; topic: Topic; topicIndex: number; question: Question; questionIndex: number }
  | { kind: 'countdown'; round: Round; roundIndex: number };
