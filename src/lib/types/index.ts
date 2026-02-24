export interface ApiResponse<T> {
  data: T | null;
  meta?: {
    requestId: string;
    timestamp: string;
    cache?: 'hit' | 'miss';
    ttl?: number;
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
  error: ApiError | null;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_SUBSCRIPTION'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface DramaCard {
  id: string;
  providerSlug: string;
  providerDramaId: string;
  title: string;
  coverUrl: string;
  episodeCount: number;
  rating?: number;
  tags: string[];
  isPremium: boolean;
  providerName: string;
  vipLevel: string;
}

export interface DramaDetail extends DramaCard {
  synopsis: string;
  genres: string[];
  language: string;
  lastUpdated: string;
  popularityScore?: number;
}

export interface EpisodeItem {
  episodeId: string;
  providerEpisodeId?: string;
  episodeNo: number;
  chapterId?: string;
  slug?: string;
  title: string;
  durationMs: number;
  isLocked: boolean;
  thumbnailUrl?: string;
}

export interface PlaybackResponse {
  streamUrl: string;
  mimeType?: string;
  headers?: Record<string, string>;
  expiresAt: string;
  nextEpisode?: {
    episodeId: string;
    episodeNo: number;
  };
}

export interface WatchProgress {
  userId: string;
  dramaId: string;
  episodeId: string;
  progressSeconds: number;
  isCompleted: boolean;
  lastWatchedAt: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  status: string;
  plan: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  updated_at: string;
}

export interface ContinueWatchingItem {
  dramaId: string;
  dramaTitle: string;
  episodeId: string;
  episodeNo: number;
  progressSeconds: number;
  durationMs: number;
  coverUrl: string;
  providerSlug: string;
}

export interface ProviderEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  pathParams: string[];
  sampleUrl: string;
}

export interface Provider {
  vip: string;
  provider: string;
  slug: string;
  baseUrl: string;
  endpointCount: number;
  endpoints: ProviderEndpoint[];
  status: 'active' | 'maintenance' | 'disabled';
  capabilities?: ProviderCapabilities;
}

export interface ProviderCapabilities {
  supportsHome: boolean;
  supportsSearch: boolean;
  supportsEpisodeList: boolean;
  supportsPlayback: boolean;
  supportsSubtitle: boolean;
  supportsUnlock: boolean;
  playbackType: 'play' | 'stream' | 'video' | 'unknown';
}

export type Intent =
  | 'home'
  | 'search'
  | 'detail'
  | 'episodes'
  | 'playback'
  | 'subtitle'
  | 'unlock';

export interface ResolvedEndpoint {
  provider: string;
  intent: Intent;
  endpoint: ProviderEndpoint;
  url: string;
  missingParams: string[];
}
