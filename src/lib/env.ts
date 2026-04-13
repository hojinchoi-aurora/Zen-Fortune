import type { APIContext } from 'astro';

/**
 * Reads runtime env. Works in both `astro dev` (uses platformProxy → process.env)
 * and Cloudflare Pages production (uses locals.runtime.env).
 */
export function readEnv(context: { locals: App.Locals }): Env {
  const cf = context.locals.runtime?.env as Partial<Env> | undefined;
  const fromProcess = (typeof process !== 'undefined' ? process.env : {}) as Partial<Env>;

  const merged = { ...fromProcess, ...cf };
  const required: (keyof Env)[] = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_PASSWORD',
    'SESSION_SECRET',
  ];

  for (const key of required) {
    if (!merged[key]) {
      throw new Error(`Missing env: ${key}. Set it in .dev.vars or via wrangler secret put.`);
    }
  }

  return merged as Env;
}

export type AstroCtx = APIContext;
