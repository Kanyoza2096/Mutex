# Kanyoza Systems AI Platform v10 - Command Console

## Overview
The Kanyoza Systems AI Platform v10 Command Console is an enterprise-grade front-end interface designed to monitor, configure, and orchestrate the Kanyoza Python/Flask backend. It provides real-time telemetry, automated workflow visualization, and AI behavior management.

## Key Capabilities

*   **Command Center (Dashboard):** Real-time telemetry, system health matrix, and aggregated message/post metrics.
*   **Content Studio:** Centralized view for scheduled, published, and drafted social media posts.
*   **Workflow Engine:** Live visualizer for automation pipelines (e.g., `PostPublishWorkflow`), tracking worker states, thread-pool capacity, and step-by-step execution.
*   **AI Personality Matrix:** Granular control over the LLM's communication tone, assertiveness, and humor, along with system prompt overrides and active model routing (e.g., Gemini 1.5 Pro vs. Flash).
*   **Live Payload Inspector:** Real-time network traffic debugger with inbound/outbound JSON payload inspection, latency tracking, and status monitoring.
*   **Prometheus Metrics:** Grafana-style telemetry exporter featuring CPU/Memory load visualizations, HTTP request rates, and a PromQL query explorer interface.
*   **Code Guardian:** Security and anomaly scanning sub-routines with visual alerts.
*   **System Config & Credentials:** Secure environment variable management and backend routing configurations.
*   **System Terminal:** Built-in floating command line interface for direct system commands (`/post`, `/scan`, `/ping`).

## Technical Stack
*   **Framework:** React 18 with Vite
*   **Styling:** Tailwind CSS (Custom "Command Center Dark" theme)
*   **State Management:** Zustand (Client-side state & Terminal history)
*   **Icons:** Lucide React
*   **Animations:** Framer Motion (`motion/react`)

## Connection to Backend
This front-end console is designed to interface with the Kanyoza Systems Python 3.12 + Flask backend. 

1. Navigate to **System Config > Engine Credentials** in the sidebar.
2. Set the **WebSocket Endpoint URL** for real-time telemetry.
3. Set the **REST API Base URL**.
4. Configure the **Master API Token** to authenticate outbound requests to the backend API.
5. Provide third-party integration keys (Gemini API, Facebook Graph API, Supabase) to synchronize with the backend's environment variables.

## Running the Console Locally

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

## Architecture Philosophy
*   **Dark-Mode First:** Designed to minimize eye strain during long monitoring sessions, utilizing a custom "Command Center Dark" theme.
*   **Data-Dense:** Prioritizes showing relevant system metrics, JSON logs, and workflow steps without overwhelming the operator.
*   **Resilient:** Visually degrades gracefully if the WebSocket connection is interrupted, maintaining access to static logs and configurations.
