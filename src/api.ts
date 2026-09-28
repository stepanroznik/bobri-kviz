import type { Quiz } from './types';

export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // A non-JSON error still has a useful HTTP status message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function loadQuiz(adminKey: string | null): Promise<Quiz> {
  const isAdmin = Boolean(adminKey);
  try {
    return await api<Quiz>(isAdmin ? '/api/admin/quiz' : '/api/quiz', {
      headers: isAdmin ? { 'X-Admin-Key': adminKey! } : undefined,
    });
  } catch (error) {
    if (isAdmin) throw error;
    try {
      return await fetch('/default-quiz.json').then((response) => response.json() as Promise<Quiz>);
    } catch {
      // Preserve the original API error if the static fallback is also unavailable.
    }
    throw error;
  }
}
