import type { APIRoute } from 'astro';
import { readEnv } from '@/lib/env';
import { createServerClient } from '@/lib/supabase';
import { isValidDeviceToken } from '@/lib/date';
import { getOrCreateDailyFortune } from '@/lib/fortune';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token');

  if (!isValidDeviceToken(token)) {
    return Response.json({ error: 'invalid device token' }, { status: 400 });
  }

  try {
    const env = readEnv(ctx);
    const sb = createServerClient(env);
    const result = await getOrCreateDailyFortune(sb, token);
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err: any) {
    console.error('[fortune]', err);
    return Response.json({ error: err?.message ?? 'failed' }, { status: 500 });
  }
};
