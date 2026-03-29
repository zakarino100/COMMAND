# COMMAND — Social Media Scheduling Dashboard

## Overview

Internal social media scheduling and analytics dashboard for three brands: Wolf Pack Wash, Mop Mafia, and Blue Ocean. Private ops tool — no public auth, no multi-tenant, no billing.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/dashboard) — dark mode, three-column layout
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Scheduler**: node-cron (every 5 min post check, every 6h metrics sync, weekly digest)
- **AI captions**: OpenAI gpt-4o
- **Social posting**: Meta Graph API v19.0 (FB + IG), Google Business Profile v4
- **Media storage**: Supabase Storage (bucket: post-images)
- **Notifications**: Discord webhook

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server + scheduler + posting logic
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── discord.ts    # Discord webhook notifications
│   │       │   ├── posting.ts    # FB/IG/GBP posting logic
│   │       │   └── scheduler.ts  # node-cron jobs
│   │       └── routes/
│   │           ├── ai.ts         # POST /api/ai/generate-caption
│   │           ├── assets.ts     # GET/POST /api/assets
│   │           ├── brands.ts     # GET /api/brands
│   │           ├── metrics.ts    # GET /api/metrics/*
│   │           └── posts.ts      # CRUD /api/posts
│   └── dashboard/          # React + Vite frontend
│       └── src/
│           ├── pages/       # Compose, Queue, History, Performance, Library
│           ├── components/  # Layout, shared UI
│           └── contexts/    # BrandContext
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           ├── posts.ts          # posts table
│           ├── post_metrics.ts   # post_metrics table
│           ├── assets.ts         # assets table
│           └── brand_config.ts   # brand_config table (seeded)
└── scripts/                # Utility scripts
```

## Views

1. **Compose** — Platform toggles (FB/IG/GBP), content type, AI caption generation, drag-drop media, UTM link tagging, schedule picker with best-time suggestions, live post preview
2. **Queue** — Scheduled posts sorted soonest-first, cancel button
3. **History** — Past posts with filter by brand/platform/content type, inline metrics, expand
4. **Performance** — Summary cards, ranked table, insights panel, best-time heatmap
5. **Library** — Media asset grid, filter, click-to-reuse in Compose

## Design System

Dark mode only. Colors: #0A0A0A bg, #111111 surface, #1A1A1A cards, #222222 borders, #00C2FF primary, #00E5A0 success, #FFB800 warning, #FF4D4D error. Inter + JetBrains Mono fonts.

## Brands (seeded)

- `wolfpackwash` — Wolf Pack Wash 🐺
- `mopmafia` — Mop Mafia 🧹  
- `blueocean` — Blue Ocean 🌊

## Environment Variables Required

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — media storage
- `META_APP_ID`, `META_APP_SECRET` — Meta app credentials
- `META_TOKEN_{WOLFPACKWASH|MOPMAFIA|BLUEOCEAN}` — per-brand page tokens
- `META_PAGE_ID_{WOLFPACKWASH|MOPMAFIA|BLUEOCEAN}` — per-brand FB page IDs
- `GBP_CLIENT_ID`, `GBP_CLIENT_SECRET`, `GBP_REFRESH_TOKEN` — Google Business Profile
- `DISCORD_WEBHOOK_URL` — notifications
- `OPENAI_API_KEY` — AI caption generation

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes
