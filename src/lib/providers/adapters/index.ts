import { ReelShortAdapter } from './reelshort';
import { GoodShortAdapter } from './goodshort';
import { FlexTVAdapter } from './flextv';
import { CashDramaAdapter } from './cashdrama';
import { ShortMaxAdapter } from './shortmax';
import type { ProviderAdapter } from './base';

export const adapters: Map<string, ProviderAdapter> = new Map([
  ['reelshort', new ReelShortAdapter()],
  ['goodshort', new GoodShortAdapter()],
  ['flextv', new FlexTVAdapter()],
  ['cashdrama', new CashDramaAdapter()],
  ['shortmax', new ShortMaxAdapter()],
]);

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return adapters.get(slug);
}
