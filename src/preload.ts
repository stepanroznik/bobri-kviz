import { mediaUrl } from './quiz';
import type { Quiz } from './types';

export interface PreloadProgress {
  total: number;
  completed: number;
  failed: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface PreloadResult {
  assetUrls: Map<string, string>;
  failedUrls: string[];
}

function quizMediaUrls(quiz: Quiz): string[] {
  const urls = quiz.rounds.flatMap((round) => round.topics.flatMap((topic) => topic.questions.map((question) => mediaUrl(question.media))));
  return [...new Set(urls.filter(Boolean))];
}

async function downloadAsset(url: string, onBytes: (received: number, expected: number) => void): Promise<string> {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

  const expected = Number(response.headers.get('content-length')) || 0;
  if (!response.body) {
    const blob = await response.blob();
    onBytes(blob.size, expected || blob.size);
    return URL.createObjectURL(blob);
  }

  const chunks: ArrayBuffer[] = [];
  const reader = response.body.getReader();
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer);
    received += value.byteLength;
    onBytes(received, expected);
  }
  return URL.createObjectURL(new Blob(chunks, { type: response.headers.get('content-type') || undefined }));
}

/** Downloads each unique image/audio asset and keeps it alive through a Blob URL for offline playback. */
export async function preloadQuizMedia(quiz: Quiz, onProgress: (progress: PreloadProgress) => void): Promise<PreloadResult> {
  const urls = quizMediaUrls(quiz);
  const progress: PreloadProgress = { total: urls.length, completed: 0, failed: 0, downloadedBytes: 0, totalBytes: 0 };
  const assetUrls = new Map<string, string>();
  const failedUrls: string[] = [];
  const bytesByUrl = new Map<string, number>();
  const expectedByUrl = new Map<string, number>();
  onProgress({ ...progress });

  await Promise.all(urls.map(async (url) => {
    try {
      const blobUrl = await downloadAsset(url, (received, expected) => {
        bytesByUrl.set(url, received);
        if (expected) expectedByUrl.set(url, expected);
        progress.downloadedBytes = [...bytesByUrl.values()].reduce((sum, value) => sum + value, 0);
        progress.totalBytes = [...expectedByUrl.values()].reduce((sum, value) => sum + value, 0);
        onProgress({ ...progress });
      });
      assetUrls.set(url, blobUrl);
    } catch {
      failedUrls.push(url);
      progress.failed += 1;
    } finally {
      progress.completed += 1;
      onProgress({ ...progress });
    }
  }));

  return { assetUrls, failedUrls };
}
