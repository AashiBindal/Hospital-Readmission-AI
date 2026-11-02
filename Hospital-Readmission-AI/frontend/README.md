# MediSight frontend (React 19 + Vite 8 + Tailwind 4)

Talks to the Spring Boot backend in `../backend` through `src/api/axiosClient.js`.

## Run
```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build in dist/
npm run preview      # serve dist/ locally
```
Optional: copy `.env.example` to `.env` to change `VITE_API_BASE_URL` (default `http://localhost:8080/api`).
The backend must allow this origin (`FRONTEND_URL`, default `http://localhost:3000`).

## Structure
| Path | Purpose |
|---|---|
| `src/api/*Service.js` | One module per backend resource (see `../docs/API_INTEGRATION.md`) |
| `src/api/axiosClient.js` | Base URL, Bearer token, 401/403 handling, backend error messages |
| `src/context/AuthContext.jsx` | Login / register / session restore (`GET /auth/me`), notifications |
| `src/hooks/useDepartments.js` | Department list from the data (`GET /reference/departments`) |
| `src/utils/format.js` | Display helpers (age bands, percentages, "not scored") |
| `src/constants/enums.js` | Values that match the SQL Server CHECK constraints |

## Data rules
* No mock data or fallback numbers: values the backend does not have are shown as "—" or "Not scored".
* The dataset has no patient names, exact ages or dates: patients are shown as `Patient <MRN>`, ages as
  10-year bands, and charts use length of stay / age band / diagnosis category instead of months.
* Risk tiers come from the ML service; the UI never computes a tier from a score.
