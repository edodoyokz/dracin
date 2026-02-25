import { pgTable, uuid, text, timestamp, boolean, pgEnum, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { dramas, episodes } from './providers';

/**
 * Subscription tier enum
 */
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'premium', 'vip']);

/**
 * Subscription status enum
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'expired']);

/**
 * Report status enum
 */
export const reportStatusEnum = pgEnum('report_status', ['open', 'reviewing', 'resolved', 'rejected']);

/**
 * Profiles table - extends Supabase Auth users
 * 
 * This table is keyed by Supabase Auth user ID (auth.users.id).
 * Supabase Auth handles authentication, this table stores additional profile data.
 * 
 * IMPORTANT: The id column references auth.users.id via Supabase's built-in auth schema.
 * Do NOT create a separate users table - use auth.users for authentication.
 */
export const profiles = pgTable('profiles', {
    // This ID matches auth.users.id from Supabase Auth
    id: uuid('id').primaryKey(),
    email: text('email').unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Subscriptions table - internal monetization tracking
 */
export const subscriptions = pgTable('subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    tier: subscriptionTierEnum('tier').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Watch history table - tracks user viewing progress
 */
export const watchHistory = pgTable('watch_history', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    dramaId: uuid('drama_id').notNull().references(() => dramas.id, { onDelete: 'cascade' }),
    episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'set null' }),
    progressSeconds: integer('progress_seconds').default(0).notNull(),
    isCompleted: boolean('is_completed').default(false).notNull(),
    lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    userDramaEpisodeUnique: {
        columns: [table.userId, table.dramaId, table.episodeId],
        name: 'watch_history_user_id_drama_id_episode_id_key',
    },
}));

/**
 * Reports table - user reports for content moderation
 */
export const reports = pgTable('reports', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    providerSlug: text('provider_slug'),
    providerDramaId: text('provider_drama_id'),
    providerEpisodeId: text('provider_episode_id'),
    reason: text('reason').notNull(),
    notes: text('notes'),
    status: reportStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Bookmarks table - stores user's bookmarked dramas
 */
export const bookmarks = pgTable('bookmarks', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    dramaId: uuid('drama_id').notNull().references(() => dramas.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    userDramaUnique: {
        columns: [table.userId, table.dramaId],
        name: 'bookmarks_user_id_drama_id_key',
    },
}));

/**
 * Profile relations
 */
export const profilesRelations = relations(profiles, ({ many }) => ({
    subscriptions: many(subscriptions),
    watchHistory: many(watchHistory),
    reports: many(reports),
    bookmarks: many(bookmarks),
}));

/**
 * Subscription relations
 */
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    user: one(profiles, {
        fields: [subscriptions.userId],
        references: [profiles.id],
    }),
}));

/**
 * Watch history relations
 */
export const watchHistoryRelations = relations(watchHistory, ({ one }) => ({
    user: one(profiles, {
        fields: [watchHistory.userId],
        references: [profiles.id],
    }),
    drama: one(dramas, {
        fields: [watchHistory.dramaId],
        references: [dramas.id],
    }),
    episode: one(episodes, {
        fields: [watchHistory.episodeId],
        references: [episodes.id],
    }),
}));

/**
 * Report relations
 */
export const reportsRelations = relations(reports, ({ one }) => ({
    user: one(profiles, {
        fields: [reports.userId],
        references: [profiles.id],
    }),
}));

/**
 * Bookmarks relations
 */
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
    user: one(profiles, {
        fields: [bookmarks.userId],
        references: [profiles.id],
    }),
    drama: one(dramas, {
        fields: [bookmarks.dramaId],
        references: [dramas.id],
    }),
}));

// Type exports
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type WatchHistoryEntry = typeof watchHistory.$inferSelect;
export type NewWatchHistoryEntry = typeof watchHistory.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
