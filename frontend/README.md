# Antibot Dashboard

React + TypeScript + Vite dashboard for the Antibot Detection Engine.

## Features

- **Overview**: RPS, verdict distribution (pie chart), top offenders, risk score histogram, real-time event stream.
- **Traffic Drill-Down**: Search logs by IP, time range, verdict; paginated results; export to CSV/JSON.
- **Rules Management**: CRUD operations for detection rules; live rule testing using the evaluate endpoint.
- **Allow/Deny Lists**: Manage CIDR entries; bulk import/export in CSV/JSON formats.
- **Settings**: Adjust scoring thresholds, category weights, rate limit parameters, PoW settings, and generate admin tokens.

## Tech Stack

- React 18 + TypeScript
- Vite
- TailwindCSS
- Recharts
- React Router DOM
- date-fns

## Prerequisites

- Node.js 18+
- Backend API running (default: http://localhost:8000) with admin token.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and adjust `VITE_API_URL` if needed.

3. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

## Login

The dashboard uses token-based authentication. Obtain an admin token from the backend (via `/admin/tokens/generate` or default `dev-admin-token` in development) and enter it on the login page.

## Building for Production

```bash
npm run build
```

The built files will be in `dist/`. Serve with any static file server.

## Notes on Backend Compatibility

- The frontend expects the Admin API under `/admin/*` endpoints.
- Real-time updates via WebSocket at `/ws?token=<admin_token>` are supported. If unavailable, the dashboard falls back to polling the metrics endpoint every 2 seconds.
- The current backend API does not support server-side filtering by User-Agent or Endpoint in the logs endpoint. The dashboard includes these fields in the UI, but filtering is applied client-side to the current page only. Backend support is recommended.

## Project Structure

- `src/components/` - UI components
- `src/hooks/` - custom data fetching hooks
- `src/services/` - API client, auth, WebSocket
- `src/types/` - TypeScript interfaces
- `src/pages/` - page-level components (Login)

## License

MIT