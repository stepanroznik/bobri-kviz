import { json, readQuiz } from '../_lib';
import type { Env } from '../_lib';

export async function onRequestGet({ env }: { env: Env }): Promise<Response> {
  try {
    const { quiz, updatedAt } = await readQuiz(env);
    return json({ ...quiz, _updatedAt: updatedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Database error' }, 500);
  }
}
