import { ReelShortAdapter } from './reelshort';
import { GoodShortAdapter } from './goodshort';
import { FlexTVAdapter } from './flextv';
import { CashDramaAdapter } from './cashdrama';
import { ShortMaxAdapter } from './shortmax';
import { GenericProviderAdapter } from './generic';
import type { ProviderAdapter } from './base';
import { providerCatalog } from '../catalog';

// Build adapter map dynamically from catalog
function buildAdapters(): Map<string, ProviderAdapter> {
  const map = new Map<string, ProviderAdapter>();

  // Register specific adapters for providers that need custom handling
  map.set('reelshort', new ReelShortAdapter());
  map.set('goodshort', new GoodShortAdapter());
  map.set('flextv', new FlexTVAdapter());
  map.set('cashdrama', new CashDramaAdapter());
  map.set('shortmax', new ShortMaxAdapter());

  // Register generic adapters for all active providers
  const activeProviders = providerCatalog.getActiveProviders();
  for (const provider of activeProviders) {
    if (!map.has(provider.slug)) {
      map.set(
        provider.slug,
        new GenericProviderAdapter(provider.provider, provider.slug, provider.vip)
      );
    }
  }

  return map;
}

export const adapters = buildAdapters();

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return adapters.get(slug);
}

export function getAllAdapterSlugs(): string[] {
  return Array.from(adapters.keys());
}

export function getActiveProviderCount(): number {
  return adapters.size;
}
