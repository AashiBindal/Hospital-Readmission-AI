# Frontend — React + Vite + TypeScript

**Owner:** Member 1 · **Branch:** `frontend` · **Port:** 5173

## Stack
React 18, Vite 6, TypeScript, Tailwind CSS v4 (via `@tailwindcss/vite`), React Router v6, Axios, Recharts, Lucide React.

## Setup
```bash
cd frontend
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8080/api
npm install
npm run dev                 # http://localhost:5173
npm run build               # type-check + production build
```

## Structure
```
src/
├── assets/            static images, logos
├── components/
│   ├── common/        reusable UI (PageHeader, Placeholder, ...)
│   ├── layout/        MainLayout, Sidebar, Header
│   ├── dashboard/     KPI cards, charts
│   ├── patients/      tables, detail panels
│   ├── uploads/       upload widgets
│   ├── predictions/   risk tables, badges
│   ├── followups/     worklists
│   └── reports/       export UIs
├── pages/             one component per route
├── routes/            AppRoutes.tsx + paths.ts
├── services/          apiClient.ts (Axios) + one service per resource
├── hooks/             custom hooks (useBackendHealth, ...)
├── context/           AuthContext
├── types/             shared TS types (mirror backend DTOs)
├── utils/             formatters, constants
├── App.tsx
└── main.tsx
```

## Routes
| Path | Page |
|---|---|
| `/login` | Login |
| `/dashboard` | Dashboard |
| `/patients` | Patients |
| `/upload` | Upload |
| `/data-quality` | Data Quality |
| `/predictions` | Predictions |
| `/followups` | Follow-ups |
| `/reports` | Reports |

## Connectivity
- All HTTP calls go through `src/services/apiClient.ts` using `VITE_API_BASE_URL`.
- The header shows a live dot for `GET /api/health` on the backend (green = online).
- The frontend must **never** call the ML service or the database directly.

## TODO (Member 1)
- Real login + protected routes
- Page implementations and Recharts dashboards
- Error / loading states
