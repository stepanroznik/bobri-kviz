import { arrayBufferToBase64, authorized, ensureDb, json } from '../../_lib';
import type { Env } from '../../_lib';

const MAX_MEDIA_BYTES = 1_300_000;
interface Context { request: Request; env: Env }

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  if (!authorized(request, env)) return json({ error: 'Neplatný admin klíč' }, 401);
  try {
    await ensureDb(env);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const name = url.searchParams.get('name') || 'soubor';
    if (!id) return json({ error: 'Chybí id' }, 400);
    const data = await request.arrayBuffer();
    if (data.byteLength > MAX_MEDIA_BYTES) return json({ error: 'Soubor je větší než 1,3 MB' }, 413);
    const mime = request.headers.get('content-type') || 'application/octet-stream';
    await env.DB.prepare('INSERT INTO media(id,name,mime,data,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,mime=excluded.mime,data=excluded.data,updated_at=CURRENT_TIMESTAMP').bind(id, name, mime, arrayBufferToBase64(data)).run();
    return json({ ok: true, id, name, mime, size: data.byteLength });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Upload failed' }, 500);
  }
}

export async function onRequestDelete({ request, env }: Context): Promise<Response> {
  if (!authorized(request, env)) return json({ error: 'Neplatný admin klíč' }, 401);
  try {
    await ensureDb(env);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'Chybí id' }, 400);
    await env.DB.prepare('DELETE FROM media WHERE id=?').bind(id).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Delete failed' }, 500);
  }
}
