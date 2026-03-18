# ShutterDay

A web-based tool to manage school photography end-to-end: rosters, shoot days, photo matching, parent proofs, and orders.

**Live:** https://shutterday.fly.dev

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** SQLite via Prisma ORM
- **Auth:** Custom email/password with JWT
- **Payments:** Stripe (card) + Venmo/Zelle (manual confirmation)
- **Styling:** Tailwind CSS + shadcn/ui
- **Hosting:** Fly.io with persistent volume

## Getting Started

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Account

After running `npm run db:seed`:

| Field    | Value                      |
|----------|----------------------------|
| Email    | `demo@schoolphotos.com`    |
| Password | `password123`              |

The seed includes 2 schools, 15 students, 2 events, 3 photo packages, 5 sample orders, and proof links.

## Scripts

| Command              | Description                  |
|----------------------|------------------------------|
| `npm run dev`        | Start dev server             |
| `npm run build`      | Production build             |
| `npm run db:migrate` | Run Prisma migrations        |
| `npm run db:seed`    | Seed database with demo data |
| `npm run db:studio`  | Open Prisma Studio           |

## Environment Variables

Copy `.env.local` for local development. Required variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="dev-secret-change-in-production"

# Storage
STORAGE_PROVIDER="local"
STORAGE_LOCAL_PATH=""  # defaults to ./uploads

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Stripe (optional — app works without these, Venmo/Zelle only)
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
```

## Deployment (Fly.io)

The app is configured for Fly.io with a Dockerfile and `fly.toml`. SQLite and photo uploads are stored on a persistent volume mounted at `/data`.

### Prerequisites

```bash
brew install flyctl
flyctl auth login
```

### First-time setup

```bash
# Create the app (pick a unique name)
flyctl apps create your-app-name

# Create a 1GB persistent volume for the DB and photos
flyctl volumes create data --region ord --size 1 --yes

# Set secrets
flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)"

# Optional: Stripe keys
flyctl secrets set \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

Update `fly.toml` with your app name and URL:

```toml
app = 'your-app-name'

[env]
  NEXT_PUBLIC_APP_URL = 'https://your-app-name.fly.dev'
```

### Deploy

```bash
flyctl deploy
```

The Dockerfile builds a standalone Next.js image. On startup, `start.sh` runs `prisma migrate deploy` to apply any pending migrations, then starts the server.

### Subsequent deploys

Just run `flyctl deploy` again. Migrations run automatically on startup.

### Monitoring

```bash
flyctl logs              # Tail logs
flyctl status            # Machine status
flyctl ssh console       # SSH into the running machine
flyctl volumes list      # Check volume status
```

### Scaling the volume

If you need more storage for photos:

```bash
flyctl volumes extend <volume-id> --size 5  # Expand to 5GB
```

## Project Structure

```
src/
  app/
    (auth)/          Login, register
    (dashboard)/     Photographer dashboard (protected)
      dashboard/
        page.tsx         Home — stats, upcoming events, recent orders
        schools/         School + roster management, packages & pricing
        events/          Event scheduling, shoot day, photos, proofs
        orders/          Order dashboard
        reports/         Revenue + missing student reports
    (parent)/        Parent-facing (no auth required)
      proof/[token]/     Proof gallery + ordering
    api/             API routes
  components/        UI components, error boundary, toasts, skeletons
  lib/               Auth, DB, storage, Stripe, orders, matching, QR
prisma/
  schema.prisma      Database schema
  seed.ts            Demo data
```

## Features by Phase

1. **Auth & Foundation** — Registration, login, JWT sessions, dashboard layout
2. **School & Roster** — CRUD, CSV import with column mapping, sibling linking
3. **Event Scheduling** — Picture days, class order, QR sheet generation
4. **Shoot Day** — Mobile-first checklist, QR scanning, walk-ups, shoot log
5. **Photo Upload & Matching** — Bulk upload, sequence/QR/filename matching, review UI
6. **Parent Proofs** — Private proof links, access codes, family grouping, pose selection
7. **Orders & Payments** — Packages, Stripe checkout, Venmo/Zelle flow, order dashboard, lab CSV export
8. **Reporting & Polish** — Revenue reports, missing students, error boundaries, loading skeletons, PWA manifest, accessibility

## Payment Flow

Parents have two options at checkout:

- **Card (Stripe):** Redirects to Stripe Checkout. Webhook auto-marks order as paid.
- **Venmo/Zelle:** Creates order as "awaiting payment" and shows the photographer's payment instructions. Photographer manually confirms payment from the order dashboard.

Payment instructions are configured per school under Packages & Pricing.
