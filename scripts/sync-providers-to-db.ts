/**
 * Sync all 41 active providers from catalog.json to database
 * Run with: npx tsx scripts/sync-providers-to-db.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { providers } from '../src/lib/db/schema/providers';
import catalogData from '../src/lib/providers/catalog.json';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('Syncing providers to database...\n');

  const activeProviders = catalogData.providers.filter(p => p.status === 'active');
  console.log(`Found ${activeProviders.length} active providers\n`);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const provider of activeProviders) {
    try {
      // Check if provider exists
      const existing = await db.select().from(providers).where(eq(providers.slug, provider.slug));

      const providerData = {
        slug: provider.slug,
        name: provider.provider,
        vipGroup: provider.vip,
        status: 'active' as const,
        endpoints: {
          baseUrl: provider.baseUrl,
          endpoints: provider.endpoints,
        },
        capabilities: {
          supportsHome: provider.endpoints.some(e =>
            /\/(home|foryou|feed|popular|ranking|rank|browse|discover|list|recommend)/i.test(e.path)
          ),
          supportsSearch: provider.endpoints.some(e => /search/i.test(e.path)),
          supportsEpisodeList: provider.endpoints.some(e => /episodes?/i.test(e.path)),
          supportsPlayback: provider.endpoints.some(e => /\/(play|stream|video)/i.test(e.path)),
          supportsSubtitle: provider.endpoints.some(e => /subtitle/i.test(e.path)),
          supportsUnlock: provider.endpoints.some(e => /unlock/i.test(e.path)),
          endpointCount: provider.endpointCount,
        },
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        // Update existing
        await db.update(providers)
          .set(providerData)
          .where(eq(providers.slug, provider.slug));
        updated++;
        console.log(`✓ Updated: ${provider.slug} (${provider.provider})`);
      } else {
        // Insert new
        await db.insert(providers).values({
          ...providerData,
          createdAt: new Date(),
        });
        inserted++;
        console.log(`✓ Inserted: ${provider.slug} (${provider.provider})`);
      }
    } catch (error) {
      errors++;
      console.error(`✗ Failed: ${provider.slug} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${activeProviders.length}`);

  await client.end();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
