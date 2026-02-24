import type { Provider, ProviderCapabilities, Intent, ResolvedEndpoint, ProviderEndpoint } from '../types';
import catalogData from './catalog.json';

interface CatalogData {
  generatedAt: string;
  host: string;
  authHeader: string;
  providers: Provider[];
}

class ProviderCatalog {
  private providers: Map<string, Provider> = new Map();
  private capabilities: Map<string, ProviderCapabilities> = new Map();

  constructor() {
    this.loadFromJson();
  }

  private loadFromJson(): void {
    const data = catalogData as CatalogData;
    
    for (const provider of data.providers) {
      this.providers.set(provider.slug, provider);
      if (provider.capabilities) {
        this.capabilities.set(provider.slug, provider.capabilities);
      }
    }
  }

  getProvider(slug: string): Provider | undefined {
    return this.providers.get(slug);
  }

  getAllProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  getActiveProviders(): Provider[] {
    return this.getAllProviders().filter(p => p.status === 'active');
  }

  getCapabilities(slug: string): ProviderCapabilities | undefined {
    return this.capabilities.get(slug);
  }

  resolveEndpoint(
    slug: string,
    intent: Intent,
    params: Record<string, string> = {}
  ): ResolvedEndpoint | null {
    const provider = this.getProvider(slug);
    if (!provider || provider.status !== 'active') {
      return null;
    }

    const endpoint = this.findBestEndpoint(provider.endpoints, intent);
    if (!endpoint) {
      return null;
    }

    const missingParams: string[] = [];
    let url = endpoint.path;

    for (const param of endpoint.pathParams) {
      const value = params[param];
      if (!value) {
        missingParams.push(param);
        continue;
      }
      url = url.replace(`:${param}`, encodeURIComponent(value));
    }

    return {
      provider: slug,
      intent,
      endpoint,
      url: `${provider.baseUrl}${url}`,
      missingParams,
    };
  }

  private findBestEndpoint(endpoints: ProviderEndpoint[], intent: Intent): ProviderEndpoint | null {
    const patterns = this.getIntentPatterns(intent);
    
    for (const pattern of patterns) {
      const match = endpoints.find(ep => {
        if (pattern.method && ep.method !== pattern.method) return false;
        return pattern.regex.test(ep.path);
      });
      if (match) return match;
    }

    return null;
  }

  private getIntentPatterns(intent: Intent): Array<{ method?: string; regex: RegExp }> {
    const patterns: Record<Intent, Array<{ method?: string; regex: RegExp }>> = {
      home: [
        { regex: /\/(foryou|home|homepage|feed)/i },
      ],
      search: [
        { regex: /search/i },
      ],
      detail: [
        { regex: /\/(drama|dramas|series|book)\/:/i },
        { regex: /\/(detail|info)\/:/i },
      ],
      episodes: [
        { regex: /\/(episodes|chapters)/i },
        { regex: /\/book\/.*\/episodes/i },
      ],
      playback: [
        { regex: /\/(play|stream)/i },
        { regex: /\/video/i },
        { regex: /\/(episode|episodes)\/.*\/(play|video)/i },
      ],
      subtitle: [
        { regex: /subtitle/i },
      ],
      unlock: [
        { method: 'POST', regex: /unlock/i },
      ],
    };

    return patterns[intent] || [];
  }
}

export const providerCatalog = new ProviderCatalog();
