import { base64ToBytes, ensureDb } from '../../_lib';
import type { Env } from '../../_lib';

interface MediaRow { name: string; mime: string; data: string }
interface Context { params: { id?: string }; env: Env }

export async function onRequestGet({ params, env }: Context): Promise<Response> {
  try {
    await ensureDb(env);
    const row = await env.DB.prepare('SELECT name,mime,data,updated_at FROM media WHERE id=?').bind(params.id).first<MediaRow>();
    if (!row) return new Response('Not found', { status: 404 });

    const bytes = base64ToBytes(row.data);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        'content-type': row.mime,
        'cache-control': 'public, max-age=31536000, immutable',
        'content-disposition': `inline; filename="${String(row.name).replace(/"/g, '')}"`,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Media error', { status: 500 });
  }
}
