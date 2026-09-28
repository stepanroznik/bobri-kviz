import { DEFAULT_QUIZ } from './_seed';
import type { Quiz } from '../src/types';

export interface Env { ADMIN_KEY?: string; DB: D1Database }
interface StateRow { json: string; updated_at: string }

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
export function authorized(request: Request, env: Env): boolean {
  const key = request.headers.get('X-Admin-Key') || new URL(request.url).searchParams.get('admin') || '';
  return Boolean(env.ADMIN_KEY) && key === env.ADMIN_KEY;
}
export async function ensureDb(env: Env): Promise<void> {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  if (!await env.DB.prepare('SELECT id FROM state WHERE id=1').first()) await env.DB.prepare('INSERT INTO state (id,json) VALUES (1,?)').bind(JSON.stringify(DEFAULT_QUIZ)).run();
}
export async function readQuiz(env: Env): Promise<{ quiz: Quiz; updatedAt: string }> {
  await ensureDb(env);
  const row = await env.DB.prepare('SELECT json, updated_at FROM state WHERE id=1').first<StateRow>();
  if (!row) throw new Error('Quiz state is missing');
  return { quiz: JSON.parse(row.json) as Quiz, updatedAt: row.updated_at };
}
export async function writeQuiz(env: Env, quiz: Quiz): Promise<void> {
  await ensureDb(env);
  await env.DB.prepare('UPDATE state SET json=?, updated_at=CURRENT_TIMESTAMP WHERE id=1').bind(JSON.stringify(quiz)).run();
}
/** Structure is flexible; these checks protect only malformed payloads, not content counts. */
export function validateQuiz(quiz: unknown): string | null {
  if (!quiz || typeof quiz !== 'object') return 'Neplatný JSON';
  const candidate = quiz as Partial<Quiz>;
  if (!Array.isArray(candidate.rounds)) return 'Kvíz musí obsahovat seznam kol';
  for (const [roundIndex, round] of candidate.rounds.entries()) {
    if (!Array.isArray(round.topics)) return `Kolo ${roundIndex + 1} musí obsahovat seznam témat`;
    for (const [topicIndex, topic] of round.topics.entries()) if (!Array.isArray(topic.questions)) return `Téma ${roundIndex + 1}.${topicIndex + 1} musí obsahovat seznam otázek`;
  }
  return null;
}
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer); let output = ''; const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) output += String.fromCharCode(...bytes.subarray(index, Math.min(bytes.length, index + chunkSize)));
  return btoa(output);
}
export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value); const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
