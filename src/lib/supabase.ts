import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export function getTableChannel(tableId: string) {
  return supabase.channel(`roulette:${tableId}`, {
    config: { broadcast: { self: true }, presence: { key: '' } },
  });
}
