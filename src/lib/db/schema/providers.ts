import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Provider status enum
 */
export const providerStatusEnum = pgEnum('provider_status', ['active', 'maintenance', 'disabled']);

/**
 * Providers table - stores streaming provider information
 */
export const providers = pgTable('providers', {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').unique().notNull(),
    name: text('name').notNull(),
    vipGroup: text('vip_group'),
    status: providerStatusEnum('status').default('active').notNull(),
    endpoints: jsonb('endpoints'),
    capabilities: jsonb('capabilities'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Dramas table - stores drama/series information
 */
export const dramas = pgTable('dramas', {
    id: uuid('id').primaryKey().defaultRandom(),
    providerSlug: text('provider_slug').notNull().references(() => providers.slug),
    providerDramaId: text('provider_drama_id').notNull(),
    title: text('title').notNull(),
    synopsis: text('synopsis'),
    coverUrl: text('cover_url'),
    coverUrls: jsonb('cover_urls'),
    language: text('language'),
    genres: jsonb('genres'),
    tags: jsonb('tags'),
    episodeCount: integer('episode_count'),
    isPremium: boolean('is_premium').default(false).notNull(),
    popularityScore: numeric('popularity_score'),
    lastProviderUpdate: timestamp('last_provider_update', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    providerDramaUnique: {
        columns: [table.providerSlug, table.providerDramaId],
        name: 'dramas_provider_slug_provider_drama_id_key',
    },
}));

/**
 * Episodes table - stores episode information for dramas
 */
export const episodes = pgTable('episodes', {
    id: uuid('id').primaryKey().defaultRandom(),
    dramaId: uuid('drama_id').notNull().references(() => dramas.id, { onDelete: 'cascade' }),
    providerSlug: text('provider_slug').notNull().references(() => providers.slug),
    providerEpisodeId: text('provider_episode_id'),
    episodeNo: integer('episode_no'),
    chapterId: text('chapter_id'),
    slug: text('slug'),
    title: text('title'),
    durationMs: integer('duration_ms'),
    isLocked: boolean('is_locked').default(false).notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Provider relations
 */
export const providersRelations = relations(providers, ({ many }) => ({
    dramas: many(dramas),
    episodes: many(episodes),
}));

/**
 * Drama relations
 */
export const dramasRelations = relations(dramas, ({ one, many }) => ({
    provider: one(providers, {
        fields: [dramas.providerSlug],
        references: [providers.slug],
    }),
    episodes: many(episodes),
}));

/**
 * Episode relations
 */
export const episodesRelations = relations(episodes, ({ one }) => ({
    drama: one(dramas, {
        fields: [episodes.dramaId],
        references: [dramas.id],
    }),
    provider: one(providers, {
        fields: [episodes.providerSlug],
        references: [providers.slug],
    }),
}));
