# Production Readiness Plan - dracinhub

**Document Version**: 1.0  
**Last Updated**: 2026-02-24  
**Status**: MVP Complete → Production Preparation

---

## Executive Summary

Platform MVP telah selesai dengan 37 file implementasi. Dokumen ini merinci langkah-langkah untuk membuat platform production-ready dengan fokus pada: deployment, testing, monitoring, security, dan scalability.

---

## Phase 1: Pre-Production Setup (Week 1)

### 1.1 Environment Configuration
- [ ] **Production Environment Variables**
  ```bash
  # Supabase Production
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  
  # Upstash Redis Production
  UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
  UPSTASH_REDIS_REST_TOKEN=AZ...
  
  # Captain API Production Token
  CAPTAIN_API_TOKEN=xxx...
  
  # Vercel/Deployment
  VERCEL_TOKEN=xxx...
  ```

- [ ] **Database Migration Scripts**
  - Setup production database di Supabase
  - Run `DB_SCHEMA.sql`
  - Verify tables: providers, dramas, episodes, users, subscriptions, watch_history

- [ ] **Secret Management**
  - Gunakan Vercel Environment Variables untuk production
  - Atau gunakan AWS Secrets Manager / HashiCorp Vault untuk enterprise
  - Jangan commit secrets ke repository

### 1.2 Initial Data Population
- [ ] **Run Ingestion Jobs**
  ```bash
  # 1. Sync providers
  npx ts-node src/jobs/sync-providers.ts
  
  # 2. Sync home dramas (untuk 5 golden providers)
  npx ts-node src/jobs/sync-home-dramas.ts
  
  # 3. Verify data
  # Check Supabase dashboard - tabel providers dan dramas harus terisi
  ```

- [ ] **Provider Priority Setup**
  - Golden Providers (5): ReelShort, GoodShort, FlexTV, CashDrama, ShortMax
  - Batch A (8): HiShort, MicroDrama, MeloShort, StardustTV, SnackShort, Velolo, FreeReels, FlickReels
  - Batch B (10): remaining VIP5-VIP7
  - Batch C (10): remaining VIP8-VIP9
  - Batch D (8): edge cases

---

## Phase 2: Testing & Quality Assurance (Week 1-2)

### 2.1 Unit Testing
```typescript
// tests/unit/captain-client.test.ts
// tests/unit/resolver.test.ts
// tests/unit/rate-limiter.test.ts
// tests/unit/adapters/reelshort.test.ts
```

- [ ] **HTTP Client Tests**
  - Timeout handling (10s default)
  - Retry logic (max 2 retries)
  - 429 rate limit handling
  - Error normalization

- [ ] **Provider Resolver Tests**
  - Intent mapping accuracy
  - Path parameter extraction
  - Endpoint selection priority

- [ ] **Adapter Tests** (per provider)
  - Map home response
  - Map search response
  - Map detail response
  - Map episodes response
  - Map playback response

### 2.2 Integration Testing
```typescript
// tests/integration/api/home.test.ts
// tests/integration/api/search.test.ts
// tests/integration/api/playback.test.ts
```

- [ ] **API Endpoint Tests**
  - GET /v1/home → returns DramaCard[]
  - GET /v1/dramas/{id} → returns DramaDetail
  - GET /v1/dramas/{id}/episodes → returns EpisodeItem[]
  - GET /v1/search?q=love → returns cached results
  - GET /v1/playback → checks entitlement, returns stream URL
  - POST /v1/watch/progress → saves progress

- [ ] **Database Integration**
  - Supabase connection pooling
  - Query performance (< 200ms p95)
  - RLS policies verification

- [ ] **Cache Integration**
  - Redis connection
  - TTL enforcement (search 24h, playback 90s)
  - Cache invalidation

### 2.3 E2E Testing
```typescript
// tests/e2e/flow.test.ts
```

- [ ] **User Journey Tests**
  1. Browse Home → click drama → view detail → select episode → play
  2. Search "CEO" → select result → view detail
  3. Play episode → pause → resume → verify progress saved
  4. Premium content → verify entitlement check → upgrade prompt

### 2.4 Load Testing
- [ ] **Rate Limiter Validation**
  ```bash
  # Test 45 req/s limit
  k6 run --vus 100 --duration 60s load-test.js
  ```

- [ ] **Concurrent Users**
  - 100 concurrent users browsing
  - 50 concurrent video plays
  - Monitor: response time, error rate, cache hit ratio

---

## Phase 3: Security Hardening (Week 2)

### 3.1 API Security
- [ ] **CORS Configuration**
  ```typescript
  // next.config.ts
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        ],
      },
    ];
  }
  ```

- [ ] **Input Validation**
  - Implement Zod schemas for all API inputs
  - Sanitize search queries (SQL injection prevention)
  - Validate UUID formats

- [ ] **Token Security**
  - Captain API token: server-side only ✅
  - Supabase service role: server-side only ✅
  - Redis token: server-side only ✅

### 3.2 Playback Security
- [ ] **Stream URL Protection**
  - Proxy all playback through /v1/playback ✅
  - Short-lived URLs (60-120s expiration) ✅
  - No direct provider URLs to client ✅

- [ ] **Entforcement Verification**
  - Test: Free user accessing premium → 403 Forbidden
  - Test: Expired subscription → 403 Forbidden
  - Test: Valid subscription → 200 OK with stream URL

### 3.3 Rate Limiting & DDoS Protection
- [ ] **Upstash Rate Limiter** ✅ Implemented
  - Global: 45 req/s
  - Per-provider: configurable
  - IP-based (future): add IP tracking

- [ ] **Vercel Edge Protection**
  - Enable Vercel DDoS protection
  - Configure rate limits at edge

---

## Phase 4: Monitoring & Observability (Week 2)

### 4.1 Logging Infrastructure
- [ ] **Structured Logging** ✅ Implemented
  ```json
  {
    "level": "INFO",
    "timestamp": "2026-02-24T10:00:00Z",
    "message": "playback_completed",
    "requestId": "uuid",
    "provider": "reelshort",
    "latencyMs": 145,
    "statusCode": 200
  }
  ```

- [ ] **Log Aggregation**
  - Vercel Log Drains → Datadog/Logz.io
  - Or: Custom logging to Supabase

### 4.2 Metrics Dashboard
- [ ] **Key Metrics**
  | Metric | Target | Alert Threshold |
  |--------|--------|-----------------|
  | P95 Latency (Home) | < 200ms | > 500ms |
  | P95 Latency (Search) | < 800ms | > 1500ms |
  | Playback Success Rate | > 97% | < 95% |
  | Cache Hit Ratio | > 75% | < 60% |
  | Error Rate | < 1% | > 5% |
  | Outbound Rate Limit | < 45 req/s | > 50 req/s |

- [ ] **Provider Health Dashboard**
  - Error rate per provider
  - P95 latency per provider
  - Availability status
  - Last successful sync

### 4.3 Alerting
- [ ] **Critical Alerts**
  - Provider down > 5 minutes
  - Playback success rate < 90%
  - Database connection errors
  - Redis connection errors
  - Rate limit exceeded > 10%

- [ ] **Warning Alerts**
  - P95 latency > target
  - Cache hit ratio dropping
  - Provider error rate > 5%

---

## Phase 5: Deployment Strategy (Week 3)

### 5.1 Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod

# Or with GitHub integration (recommended)
# Connect repository di Vercel dashboard
# Auto-deploy on push to main
```

- [ ] **Environment Setup**
  - Add all environment variables di Vercel dashboard
  - Verify build settings
  - Configure custom domain (opsional)

### 5.2 Database Migration
```sql
-- Run in production Supabase
-- 1. Create tables
\i DB_SCHEMA.sql

-- 2. Set up RLS policies
-- (already in schema)

-- 3. Create indexes
CREATE INDEX idx_dramas_popularity ON dramas(popularity_score DESC);
CREATE INDEX idx_episodes_drama ON episodes(drama_id, episode_no);
```

### 5.3 Cron Jobs Setup
- [ ] **Vercel Cron**
  ```json
  // vercel.json
  {
    "crons": [
      {
        "path": "/api/cron/sync-providers",
        "schedule": "0 */6 * * *"
      },
      {
        "path": "/api/cron/sync-dramas",
        "schedule": "0 */2 * * *"
      }
    ]
  }
  ```

- [ ] **Alternative: GitHub Actions**
  ```yaml
  # .github/workflows/sync.yml
  on:
    schedule:
      - cron: '0 */2 * * *'
  ```

---

## Phase 6: Performance Optimization (Week 3)

### 6.1 Frontend Optimization
- [ ] **Image Optimization**
  - Use Next.js Image component
  - Implement lazy loading
  - Use WebP format

- [ ] **Code Splitting**
  - Dynamic imports for player
  - Route-based code splitting

- [ ] **Caching**
  - ISR for static pages
  - SWR for data fetching
  - Service Worker for offline support

### 6.2 Backend Optimization
- [ ] **Database**
  - Connection pooling (Supabase default: 10)
  - Query optimization
  - Add missing indexes

- [ ] **Redis**
  - Cache warming for popular content
  - Cache invalidation strategy

- [ ] **API Response Compression**
  - Enable gzip/brotli
  - Minimize JSON payload

---

## Phase 7: Scaling Preparation (Week 4)

### 7.1 Horizontal Scaling
- [ ] **Stateless Architecture** ✅
  - No server-side state
  - All state in Supabase/Redis

- [ ] **Edge Deployment**
  - Vercel Edge Functions for API
  - Global CDN for assets

### 7.2 Database Scaling
- [ ] **Read Replicas** (Supabase Pro)
  - Scale read queries
  - Distribute load

- [ ] **Connection Pooling** (PgBouncer)
  - Handle 1000+ concurrent connections

### 7.3 Provider Scaling
- [ ] **Batch Onboarding**
  - Week 1: Golden 5 ✅
  - Week 2: Batch A (8 providers)
  - Week 3: Batch B (10 providers)
  - Week 4: Batch C+D (18 providers)

---

## Phase 8: Post-Launch (Ongoing)

### 8.1 Monitoring & Maintenance
- [ ] **Daily Checks**
  - Error logs review
  - Provider health check
  - Cache hit ratio
  - Outbound quota usage

- [ ] **Weekly Tasks**
  - Performance review
  - Provider sync verification
  - Security audit

### 8.2 Feature Iteration
- [ ] **Q2 Roadmap**
  - Continue Watching UI
  - Watch History full implementation
  - Subscription management
  - Admin dashboard

- [ ] **Q3 Roadmap**
  - Recommendation engine
  - Personalization
  - Analytics dashboard
  - Mobile app (React Native)

---

## Critical Checklist for Go-Live

### Must Have (Blocker)
- [ ] Production database migrated
- [ ] Environment variables configured
- [ ] Rate limiter active
- [ ] Basic monitoring setup
- [ ] Golden 5 providers tested
- [ ] E2E happy path passing

### Should Have (Important)
- [ ] Full test suite passing
- [ ] Performance benchmarks met
- [ ] Logging aggregation setup
- [ ] Alerting configured
- [ ] Documentation complete

### Nice to Have (Future)
- [ ] Full 41 providers
- [ ] Advanced analytics
- [ ] A/B testing setup
- [ ] Feature flags

---

## Rollback Plan

### Scenario 1: Critical Bug in Production
```bash
# Rollback to previous deployment
vercel --rollback

# Or via Vercel dashboard
# Deployments → Previous Version → Promote
```

### Scenario 2: Database Issue
```sql
-- Restore from backup
-- Supabase dashboard → Database → Backups
```

### Scenario 3: Provider Outage
- [ ] Feature flag to disable provider
- [ ] Fallback to cached content
- [ ] Manual provider disable in DB

---

## Contact & Support

**Development Team**: techprocreative  
**Repository**: https://github.com/techprocreative/dracinhubv2  
**Documentation**: See README.md, API_DOCUMENTATION.md

---

## Appendix

### A. Quick Commands
```bash
# Development
npm run dev

# Testing
npm test
npm run test:e2e
npm run test:load

# Build
npm run build

# Deploy
vercel --prod

# Database
npx ts-node src/jobs/sync-providers.ts
npx ts-node src/jobs/sync-home-dramas.ts
```

### B. Environment Variables Template
See `.env.example` in repository

### C. Provider Onboarding Checklist
- [ ] Adapter implementation
- [ ] Contract tests passing
- [ ] Capability matrix updated
- [ ] Production ingestion
- [ ] Monitoring enabled

---

**Next Review Date**: 2026-03-03  
**Document Owner**: techprocreative
