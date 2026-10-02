import type { Question } from './types';

export type AudioClip = Pick<Question, 'audioStart' | 'audioEnd'>;

export function audioClipError(clip: AudioClip, duration?: number): string {
  const start = clip.audioStart ?? 0;
  if (!Number.isFinite(start) || start < 0) return 'Začátek musí být nezáporný počet sekund.';
  if (clip.audioEnd !== undefined && (!Number.isFinite(clip.audioEnd) || clip.audioEnd <= start)) {
    return 'Konec musí být později než začátek.';
  }
  if (duration !== undefined && Number.isFinite(duration) && (start >= duration || (clip.audioEnd ?? 0) > duration + 0.05)) {
    return 'Vybraný úsek přesahuje délku nahrávky.';
  }
  return '';
}

/** Safely bounds legacy/API values to the actual recording. */
export function audioClipRange(clip: AudioClip, duration: number): { start: number; end: number } {
  const limit = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  const requestedStart = clip.audioStart ?? 0;
  const start = Number.isFinite(requestedStart) && requestedStart >= 0 && requestedStart < limit ? requestedStart : 0;
  const requestedEnd = clip.audioEnd;
  const end = requestedEnd !== undefined && Number.isFinite(requestedEnd) && requestedEnd > start
    ? Math.min(requestedEnd, limit) : limit;
  return { start, end };
}

export function formatAudioTime(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
