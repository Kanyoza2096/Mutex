# Kanyoza Systems AI Platform v12 — Command Console

## Overview
Enterprise-grade React frontend dashboard for monitoring, configuring, and orchestrating the Kanyoza Python/Flask backend. Includes real-time telemetry, workflow visualization, AI personality controls, live payload inspector, Prometheus metrics, and a built-in system terminal.

## Completed improvements (Phases 3–5)
- **Phase 3 (Job-centric publishing):** Posts.tsx and WorkflowRuns.tsx now route through the canonical `brand_id → Job → job_id → Socket.IO` flow. New `createJobPost` and `fetchJobStatus` functions added to `src/lib/api.ts`.
- **Phase 4 (Realtime-first):** Polling intervals reduced across all pages — WorkflowRuns (5s → 30s reconciliation + Socket.IO triggers), Scheduler (15s → 45s), AuditLogs (15s → 60s), Guardian (20s → 60s), PrometheusMetrics resources (5s → 30s). Fixed the Monitoring.tsx SSE fallback bug where `onerror` cleared the polling timer before it could start.
- **Phase 5 (No fake telemetry):** Removed `Math.random()` from ApiAnalytics (historical chart now shows "Today only"), IncidentCenter (timestamps use current time), and Marketplace (fake download counts removed). P99 latency renamed to "Peak" to avoid implying percentile precision the frontend cannot compute.

## Stack
- **Framework:** React 18 + Vite 6
- **Styling:** Tailwind CSS v4 (custom "Command Center Dark" theme)
- **State:** Zustand
- **Icons:** Lucide React
- **Animations:** Framer Motion (`motion/react`)
- **Auth/DB:** Supabase (configured inside the UI)
- **PWA:** vite-plugin-pwa (installable, offline-capable)

## Running the app
```bash
npm install   # install dependencies (first time only)
npm run dev   # starts on port 3000
```
The `Start application` workflow runs `npm run dev` automatically on port 3000.

## Connecting to the backend
This is a **frontend-only** project. Backend credentials are configured inside the running app:
1. Log in via the **KanyozaCommand** login screen (requires Supabase credentials in UI)
2. Navigate to **System Config → Engine Credentials**
3. Set the **WebSocket Endpoint URL**, **REST API Base URL**, and **Master API Token**
4. Optionally provide Gemini API key, Facebook Graph API key, and Supabase credentials

## Project structure
- `src/pages/` — top-level route pages (Dashboard, ContentStudio, WorkflowEngine, etc.)
- `src/components/` — shared UI components
- `src/store/` — Zustand stores
- `src/lib/` — utility helpers
- `lib/` — shared libraries (api-client-react, api-zod, db)
- `public/` — static assets and PWA icons

## User preferences
- Keep the existing dark "Command Center" visual theme
