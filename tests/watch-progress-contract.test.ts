/**
 * Tests for Watch Progress Identifier Contract
 * 
 * Tests the episode ID resolution logic in watch-history.ts:
 * - UUID passthrough (already a database episode.id)
 * - Provider-specific ID resolution (episode_no, provider_episode_id, slug, chapter_id)
 * - Fallback to null when episode not found
 * 
 * These tests verify the contract between the API and the database layer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions
const mockSingle = vi.fn();

// Create a chainable result object that supports chaining .eq() and ending with .single()
const createChainableResult = () => {
    const result: {
        eq: ReturnType<typeof vi.fn>;
        single: typeof mockSingle;
    } = {
        single: mockSingle,
        eq: vi.fn(() => result),
    };
    return result;
};

const mockSelect = vi.fn(() => createChainableResult());

// Create a mock that returns upsert result
const mockUpsert = vi.fn();

const mockFrom = vi.fn((table: string) => ({
    select: mockSelect,
    upsert: mockUpsert,
}));

// Mock the Supabase client
vi.mock('@/lib/db/client', () => ({
    getSupabaseClient: () => ({
        from: mockFrom,
    }),
}));

describe('Watch Progress Identifier Contract', () => {
    beforeEach(() => {
        // Clear mock call counts but keep implementations
        mockSingle.mockClear();
        mockSelect.mockClear();
        mockUpsert.mockClear();
        mockFrom.mockClear();

        // Set default implementations
        mockUpsert.mockResolvedValue({ error: null });
        mockSingle.mockResolvedValue({ data: null, error: null });
    });

    describe('resolveEpisodeId - UUID Passthrough', () => {
        it('should return UUID as-is when episodeId is already a valid UUID', async () => {
            const uuid = '123e4567-e89b-12d3-a456-426614174000';
            const dramaId = '123e4567-e89b-12d3-a456-426614174001';

            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId,
                episodeId: uuid,
                progressSeconds: 100,
                isCompleted: false,
            });

            // Verify upsert was called with the UUID as-is
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    episode_id: uuid,
                }),
                expect.any(Object)
            );
        });

        it('should recognize uppercase UUID format', async () => {
            const uuid = '123E4567-E89B-12D3-A456-426614174000';
            const dramaId = '123e4567-e89b-12d3-a456-426614174001';

            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId,
                episodeId: uuid,
                progressSeconds: 100,
                isCompleted: false,
            });

            // Should pass through without DB lookup for episode resolution
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    episode_id: uuid,
                }),
                expect.any(Object)
            );
        });
    });

    describe('resolveEpisodeId - Episode Number Resolution', () => {
        it('should resolve numeric episode_no to UUID', async () => {
            const dramaId = '123e4567-e89b-12d3-a456-426614174001';
            const episodeUuid = '123e4567-e89b-12d3-a456-426614174003';

            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            // Setup mock for episode lookup by episode_no - first call succeeds
            mockSingle.mockResolvedValueOnce({ data: { id: episodeUuid }, error: null });

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId,
                episodeId: '15', // Numeric episode number
                progressSeconds: 100,
                isCompleted: false,
            });

            // Verify the resolved UUID was used in upsert
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    episode_id: episodeUuid,
                }),
                expect.any(Object)
            );
        });

        it('should handle string numeric episode ID', async () => {
            const dramaId = '123e4567-e89b-12d3-a456-426614174001';
            const episodeUuid = '123e4567-e89b-12d3-a456-426614174003';

            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            mockSingle.mockResolvedValueOnce({ data: { id: episodeUuid }, error: null });

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId,
                episodeId: '1', // String "1"
                progressSeconds: 100,
                isCompleted: false,
            });

            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    episode_id: episodeUuid,
                }),
                expect.any(Object)
            );
        });
    });

    describe('resolveEpisodeId - Provider Episode ID Resolution', () => {
        it('should resolve provider_episode_id when episode_no lookup fails', async () => {
            const dramaId = '123e4567-e89b-12d3-a456-426614174001';
            const episodeUuid = '123e4567-e89b-12d3-a456-426614174003';
            const providerEpisodeId = 'ep-chapter-15-abc';

            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            // First call (episode_no lookup) fails - not a number or not found
            // Second call (provider_episode_id lookup) succeeds
            mockSingle
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // episode_no fails
                .mockResolvedValueOnce({ data: { id: episodeUuid }, error: null }); // provider_episode_id succeeds

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId,
                episodeId: providerEpisodeId,
                progressSeconds: 100,
                isCompleted: false,
            });

            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    episode_id: episodeUuid,
                }),
                expect.any(Object)
            );
        });
    });

    describe('resolveEpisodeId - Slug Resolution', () => {
        it('should resolve by slug when other lookups fail', async () => {
            const dramaId = '123e4567-e89b-12d3-a456-426614174001';
            const episodeUuid = '123e4567-e89b-12d3-a456-426614174003';
            const slug = 'episode-15-the-reveal';

            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            // episode_no fails, provider_episode_id fails, slug succeeds
            mockSingle
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
                .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
                .mockResolvedValueOnce({ data: { id: episodeUuid }, error: null });

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId,
                episodeId: slug,
                progressSeconds: 100,
                isCompleted: false,
            });

            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    episode_id: episodeUuid,
                }),
                expect.any(Object)
            );
        });
    });

    describe('upsertWatchProgress - Error Handling', () => {
        it('should throw error when upsert fails', async () => {
            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            mockUpsert.mockResolvedValueOnce({
                error: { message: 'Database error' },
            });

            await expect(
                upsertWatchProgress({
                    userId: '123e4567-e89b-12d3-a456-426614174002',
                    dramaId: '123e4567-e89b-12d3-a456-426614174001',
                    episodeId: '123e4567-e89b-12d3-a456-426614174003',
                    progressSeconds: 100,
                    isCompleted: false,
                })
            ).rejects.toThrow('Failed to save watch progress');
        });
    });

    describe('Watch Progress Data Transformation', () => {
        it('should transform camelCase to snake_case for database', async () => {
            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            const entry = {
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId: '123e4567-e89b-12d3-a456-426614174001',
                episodeId: '123e4567-e89b-12d3-a456-426614174003',
                progressSeconds: 150,
                isCompleted: true,
            };

            await upsertWatchProgress(entry);

            expect(mockUpsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: entry.userId,
                    drama_id: entry.dramaId,
                    episode_id: entry.episodeId,
                    progress_seconds: entry.progressSeconds,
                    is_completed: entry.isCompleted,
                    last_watched_at: expect.any(String),
                }),
                expect.any(Object)
            );
        });

        it('should include last_watched_at timestamp', async () => {
            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId: '123e4567-e89b-12d3-a456-426614174001',
                episodeId: '123e4567-e89b-12d3-a456-426614174003',
                progressSeconds: 100,
                isCompleted: false,
            });

            const upsertCall = mockUpsert.mock.calls[0];
            expect(upsertCall).toBeDefined();
            expect(upsertCall[0].last_watched_at).toBeDefined();

            // Verify it's a valid ISO timestamp
            const timestamp = new Date(upsertCall[0].last_watched_at);
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        });

        it('should use correct conflict target', async () => {
            const { upsertWatchProgress } = await import('@/lib/db/watch-history');

            await upsertWatchProgress({
                userId: '123e4567-e89b-12d3-a456-426614174002',
                dramaId: '123e4567-e89b-12d3-a456-426614174001',
                episodeId: '123e4567-e89b-12d3-a456-426614174003',
                progressSeconds: 100,
                isCompleted: false,
            });

            expect(mockUpsert).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({
                    onConflict: 'user_id,drama_id,episode_id',
                })
            );
        });
    });
});
