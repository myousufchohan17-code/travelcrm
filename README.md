# SkyTrail Travels CRM

Production-ready Travel Agency CRM with a React + Tailwind frontend and a Node.js + MySQL backend. Frontend and backend live in separate folders. Dashboard values come from the database. Empty states are shown when there is no data. Sample records are never seeded.

## Folders

- `frontend` — React (Vite), Tailwind CSS, Recharts
- `backend` — Express REST API, MySQL, file uploads

## Requirements

- Node.js 18+
- MySQL 8+ (this machine already has MySQL Server 8.0 / 9.7 and WAMP)

## 1. Start MySQL

Start one of these Windows services, then confirm MySQL is listening on port 3306:

- `MySQL97`
- `wampmysqld64`

Default connection in `backend/.env`:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=travel_crm
```

Update `DB_PASSWORD` if your MySQL root user has a password.

The API creates the `travel_crm` database and tables automatically on startup using `backend/schema.sql`. It does not insert dummy clients, bookings, packages, or statistics.

## 2. Install and run both together

From the project root:

```bash
npm install
npm run install:all
npm run dev
```

That starts:

- Backend API: `http://localhost:4000`
- Frontend app: `http://localhost:5173`

The Vite dev server proxies `/api` and `/uploads` to the backend.

To run them separately instead:

```bash
cd backend
npm install
npm run dev

cd frontend
npm install
npm run dev
```

The app opens the dashboard directly. There is no login or signup screen. Update the display name and company details in Settings.

## Deploy (GitHub + Vercel)

The live app needs a **hosted MySQL** database. Local WAMP/MySQL is not reachable from Vercel.

1. Create a free MySQL database (PlanetScale, TiDB Cloud, Aiven, Railway, or similar).
2. Push this repo to GitHub.
3. Import the repo in [Vercel](https://vercel.com) (root directory = repository root).
4. Add these environment variables in the Vercel project:

```
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
DB_SSL=true
CLIENT_ORIGIN=https://YOUR-APP.vercel.app
```

5. Deploy. The API lives at `/api` on the same domain as the frontend, so clients, bookings, packages, and the rest of the CRM keep working.

Schema tables are created automatically on first API request. No dummy clients or bookings are inserted.

## Features

- Dashboard matching a three-column travel CRM layout (sidebar, main, right column)
- Working search across clients, bookings, packages, leads, destinations
- Full CRUD for clients, bookings, packages, leads, follow-ups
- Destinations, agents, messages, notifications, reports, activity log
- Delete confirmation modals that remove real MySQL rows
- Charts and KPIs calculated from live data only

## API overview

All routes are open (no login token).

- `GET /api/profile` `PATCH /api/profile`
- `GET /api/dashboard/stats` and other dashboard endpoints
- `GET /api/search?q=`
- CRUD: `/api/clients` `/api/bookings` `/api/packages` `/api/leads` `/api/follow-ups`
- `/api/messages` `/api/reports` `/api/destinations` `/api/agents` `/api/notifications` `/api/activities` `/api/settings`
