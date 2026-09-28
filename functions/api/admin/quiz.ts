import { authorized, json, readQuiz, validateQuiz, writeQuiz } from '../../_lib';
import type { Env } from '../../_lib';
import type { Quiz } from '../../../src/types';

interface Context { request: Request; env: Env }

export async function onRequestGet({ request, env }: Context): Promise<Response> {
  if (!authorized(request, env)) return json({ error: 'Neplatný admin klíč' }, 401);
  try {
    const { quiz, updatedAt } = await readQuiz(env);
    return json({ ...quiz, _updatedAt: updatedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Database error' }, 500);
  }
}

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!authorized(request, env)) return json({ error: 'Neplatný admin klíč' }, 401);
  try {
    const text = await request.text();
    if (text.length > 900_000) return json({ error: 'Kvíz je příliš velký' }, 413);
    const quiz = JSON.parse(text) as Quiz;
    delete quiz._updatedAt;
    const validationError = validateQuiz(quiz);
    if (validationError) return json({ error: validationError }, 400);
    await writeQuiz(env, quiz);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Save failed' }, 500);
  }
}
