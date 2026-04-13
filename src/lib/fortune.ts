import type { SupabaseClient } from '@supabase/supabase-js';
import { todayKeyKST } from './date';

export type FortuneResult = {
  quoteId: number;
  quote: string;
  drink: string | null;
  drinkNote: string | null;
  todayKey: string;
  alreadyLiked: boolean;
};

/**
 * Returns the same fortune for a given device on a given KST day.
 * If a daily_fortunes row exists, we reuse it. Otherwise pick one and insert.
 */
export async function getOrCreateDailyFortune(
  sb: SupabaseClient,
  deviceToken: string
): Promise<FortuneResult> {
  const todayKey = todayKeyKST();

  const { data: existing } = await sb
    .from('daily_fortunes')
    .select('quote_id, drink_id, quotes(content), drinks(name, note)')
    .eq('date_key', todayKey)
    .eq('device_token', deviceToken)
    .maybeSingle();

  if (existing) {
    const liked = await hasLikedToday(sb, deviceToken, todayKey);
    return {
      quoteId: existing.quote_id,
      quote: (existing as any).quotes?.content ?? '',
      drink: (existing as any).drinks?.name ?? null,
      drinkNote: (existing as any).drinks?.note ?? null,
      todayKey,
      alreadyLiked: liked,
    };
  }

  const [{ data: quotes }, { data: drinks }] = await Promise.all([
    sb.from('quotes').select('id, content, drink_override_id').eq('is_active', true),
    sb.from('drinks').select('id, name, note').eq('is_active', true),
  ]);

  if (!quotes || quotes.length === 0) {
    throw new Error('No active quotes available.');
  }

  const pickedQuote = quotes[Math.floor(Math.random() * quotes.length)];

  let drinkRow: { id: number; name: string; note: string | null } | null = null;
  if (pickedQuote.drink_override_id) {
    drinkRow =
      drinks?.find((d) => d.id === pickedQuote.drink_override_id) ?? null;
  }
  if (!drinkRow && drinks && drinks.length > 0) {
    drinkRow = drinks[Math.floor(Math.random() * drinks.length)];
  }

  // Upsert handles a race where two concurrent loads could otherwise insert twice.
  const { error: upsertErr } = await sb
    .from('daily_fortunes')
    .upsert(
      {
        date_key: todayKey,
        device_token: deviceToken,
        quote_id: pickedQuote.id,
        drink_id: drinkRow?.id ?? null,
      },
      { onConflict: 'date_key,device_token', ignoreDuplicates: true }
    );

  if (upsertErr) throw upsertErr;

  // Re-read in case another request won the race; this guarantees consistency.
  const { data: row } = await sb
    .from('daily_fortunes')
    .select('quote_id, drink_id, quotes(content), drinks(name, note)')
    .eq('date_key', todayKey)
    .eq('device_token', deviceToken)
    .single();

  return {
    quoteId: (row as any).quote_id,
    quote: (row as any).quotes?.content ?? pickedQuote.content,
    drink: (row as any).drinks?.name ?? drinkRow?.name ?? null,
    drinkNote: (row as any).drinks?.note ?? drinkRow?.note ?? null,
    todayKey,
    alreadyLiked: false,
  };
}

export async function hasLikedToday(
  sb: SupabaseClient,
  deviceToken: string,
  todayKey: string
): Promise<boolean> {
  const { data } = await sb
    .from('likes')
    .select('quote_id')
    .eq('date_key', todayKey)
    .eq('device_token', deviceToken)
    .maybeSingle();
  return !!data;
}

export async function recordLike(
  sb: SupabaseClient,
  deviceToken: string,
  quoteId: number
): Promise<{ alreadyLiked: boolean }> {
  const todayKey = todayKeyKST();
  const { error } = await sb
    .from('likes')
    .insert({
      date_key: todayKey,
      device_token: deviceToken,
      quote_id: quoteId,
    });

  if (error) {
    if (error.code === '23505') {
      return { alreadyLiked: true };
    }
    throw error;
  }
  return { alreadyLiked: false };
}
