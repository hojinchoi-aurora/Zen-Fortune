import type { APIRoute } from 'astro';
import { readEnv } from '@/lib/env';
import { createServerClient } from '@/lib/supabase';
import { isValidDeviceToken } from '@/lib/date';
import { recordLike } from '@/lib/fortune';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  let body: { token?: string; quoteId?: number } = {};
  try {
    body = (await ctx.request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const { token, quoteId } = body;
  if (!isValidDeviceToken(token)) {
    return Response.json({ error: 'invalid device token' }, { status: 400 });
  }
  if (!Number.isFinite(quoteId) || (quoteId as number) < 1) {
    return Response.json({ error: 'invalid quoteId' }, { status: 400 });
  }

  try {
    const env = readEnv(ctx);
    const sb = createServerClient(env);
    const result = await recordLike(sb, token, quoteId as number);
    return Response.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[like]', err);
    return Response.json({ error: err?.message ?? 'failed' }, { status: 500 });
  }
};
