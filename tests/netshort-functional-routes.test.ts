import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetProviderBySlug,
  mockGetDramasByProvider,
  mockGetProviderGenres,
  mockAssessCompleteness,
  mockCaptainGet,
  mockMapHome,
  mockResolveEndpoint,
  mockGetDramaById,
  mockGetDramaByProviderId,
  mockGetEpisodesByDramaId,
  mockGetEpisodesWithFallback,
  mockSyncEpisodes,
  mockCheckEntitlement,
  mockGetPlaybackUrl,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockGetProviderBySlug: vi.fn(),
  mockGetDramasByProvider: vi.fn(),
  mockGetProviderGenres: vi.fn(),
  mockAssessCompleteness: vi.fn(),
  mockCaptainGet: vi.fn(),
  mockMapHome: vi.fn(),
  mockResolveEndpoint: vi.fn(),
  mockGetDramaById: vi.fn(),
  mockGetDramaByProviderId: vi.fn(),
  mockGetEpisodesByDramaId: vi.fn(),
  mockGetEpisodesWithFallback: vi.fn(),
  mockSyncEpisodes: vi.fn(),
  mockCheckEntitlement: vi.fn(),
  mockGetPlaybackUrl: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock('@/lib/db/providers-db', () => ({
  getProviderBySlug: mockGetProviderBySlug,
  getDramasByProvider: mockGetDramasByProvider,
  getProviderGenres: mockGetProviderGenres,
  assessProviderCatalogCompleteness: mockAssessCompleteness,
}));

vi.mock('@/lib/http/captain-client', () => ({
  createCaptainClient: () => ({
    get: mockCaptainGet,
  }),
}));

vi.mock('@/lib/providers/catalog', () => ({
  providerCatalog: {
    resolveEndpoint: mockResolveEndpoint,
  },
}));

vi.mock('@/lib/providers/adapters', () => ({
  getAdapter: () => ({
    mapHome: mockMapHome,
  }),
}));

vi.mock('@/lib/observability/logger', () => ({
  generateRequestId: () => 'req-netshort',
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/db/dramas', () => ({
  getDramaById: mockGetDramaById,
  getDramaByProviderId: mockGetDramaByProviderId,
  getEpisodesByDramaId: mockGetEpisodesByDramaId,
}));

vi.mock('@/lib/services/episode-sync', () => ({
  getEpisodesWithFallback: mockGetEpisodesWithFallback,
}));

vi.mock('@/lib/services/drama-sync', () => ({
  syncDramaFromProvider: vi.fn(),
}));

vi.mock('@/jobs/sync-episodes', () => ({
  syncEpisodes: mockSyncEpisodes,
}));

vi.mock('@/lib/db/subscriptions', () => ({
  checkEntitlement: mockCheckEntitlement,
}));

vi.mock('@/lib/services/playback', () => ({
  getPlaybackUrl: mockGetPlaybackUrl,
}));

vi.mock('@/lib/cache/redis', () => ({
  CACHE_TTL: { PLAYBACK: 90 },
  createPlaybackKey: (provider: string, drama: string, episode: string) => `playback:${provider}:${drama}:${episode}`,
  getCacheManager: () => ({
    get: mockCacheGet,
    set: mockCacheSet,
    delete: vi.fn(),
  }),
}));

describe('netshort functional routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CAPTAIN_API_TOKEN = 'token';
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockGetDramaByProviderId.mockResolvedValue(null);
    mockGetEpisodesByDramaId.mockResolvedValue([]);
  });

  it('provider route uses netshort fallback pagination params', async () => {
    mockGetProviderBySlug.mockResolvedValue({
      id: 'p1',
      slug: 'netshort',
      name: 'NetShort',
      rating: 4.5,
      dramaCount: 0,
      episodeCount: 0,
      status: 'active',
    });
    mockGetDramasByProvider.mockResolvedValue({ dramas: [], total: 0 });
    mockGetProviderGenres.mockResolvedValue([]);
    mockAssessCompleteness.mockReturnValue({ isPossiblyIncomplete: true, reason: 'db_empty' });
    mockResolveEndpoint.mockReturnValue({
      url: 'https://example.com/netshort/api/v1/feed/1',
      missingParams: [],
      endpoint: { method: 'GET', path: '/api/v1/feed/:page', pathParams: ['page'] },
    });
    mockCaptainGet.mockResolvedValue({ data: { data: [] } });
    mockMapHome.mockReturnValueOnce([
      {
        id: 'netshort:1',
        providerSlug: 'netshort',
        providerDramaId: '1',
        title: 'NetShort One',
        coverUrl: 'https://example.com/net1.jpg',
        episodeCount: 10,
        tags: [],
        isPremium: false,
        providerName: 'NetShort',
        vipLevel: 'VIP9',
      },
    ]).mockReturnValue([]);

    const { GET } = await import('@/app/api/v1/providers/[slug]/route');
    const response = await GET(new Request('http://localhost/api/v1/providers/netshort?page=1&limit=20'), {
      params: Promise.resolve({ slug: 'netshort' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    const firstUrl = mockCaptainGet.mock.calls[0]?.[0] as string;
    expect(firstUrl).toContain('page=1');
    expect(firstUrl).toContain('pageSize=20');
    expect(firstUrl).toContain('size=20');
    expect(payload.data.dramas.length).toBe(1);
  });

  it('episodes route forces netshort resync when db episodes are incomplete', async () => {
    mockGetDramaById.mockResolvedValue(null);
    mockGetDramaByProviderId.mockResolvedValue({
      id: 'uuid-drama-1',
      providerSlug: 'netshort',
      providerDramaId: 'net-123',
      episodeCount: 10,
    });
    mockGetEpisodesByDramaId
      .mockResolvedValueOnce([{ episodeNo: 1, chapterId: 'c1', providerEpisodeId: 'p1' }])
      .mockResolvedValueOnce([
        { episodeNo: 1, chapterId: 'c1', providerEpisodeId: 'p1' },
        { episodeNo: 2, chapterId: 'c2', providerEpisodeId: 'p2' },
      ]);
    mockSyncEpisodes.mockResolvedValue(undefined);

    const { GET } = await import('@/app/api/v1/dramas/[id]/episodes/route');
    const response = await GET(new Request('http://localhost/api/v1/dramas/netshort:net-123/episodes'), {
      params: Promise.resolve({ id: 'netshort:net-123' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockSyncEpisodes).toHaveBeenCalledWith('netshort', 'net-123');
    expect(payload.data.length).toBe(2);
  });

  it('playback route bypasses entitlement for netshort guest', async () => {
    mockGetPlaybackUrl.mockResolvedValue({
      streamUrl: 'https://cdn.example.com/stream.mp4',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const { GET } = await import('@/app/api/v1/playback/route');
    const response = await GET(new Request('http://localhost/api/v1/playback?provider=netshort&drama=net-123&episode=1&userId=guest'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockCheckEntitlement).not.toHaveBeenCalled();
    expect(mockGetPlaybackUrl).toHaveBeenCalledWith('netshort', 'net-123', '1', 'req-netshort');
    expect(payload.data.streamUrl).toContain('https://cdn.example.com/stream');
  });

  it('playback route still works when episode DB resolution throws', async () => {
    mockGetDramaByProviderId.mockRejectedValueOnce(new Error('db unavailable'));
    mockGetPlaybackUrl.mockResolvedValueOnce({
      streamUrl: 'https://cdn.example.com/fallback.mp4',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const { GET } = await import('@/app/api/v1/playback/route');
    const response = await GET(new Request('http://localhost/api/v1/playback?provider=netshort&drama=net-123&episode=1&userId=guest'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetPlaybackUrl).toHaveBeenCalledWith('netshort', 'net-123', '1', 'req-netshort');
    expect(payload.data.streamUrl).toContain('fallback.mp4');
  });
});
