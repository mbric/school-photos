# School Photos

A web-based tool to manage school photography end-to-end: rosters, shoot days, photo matching, parent proofs, and orders.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** SQLite via Prisma ORM
- **Auth:** Custom email/password with JWT
- **Styling:** Tailwind CSS + shadcn/ui

## Getting Started

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Account

| Field    | Value                      |
|----------|----------------------------|
| Email    | `demo@schoolphotos.com`    |
| Password | `password123`              |

## Scripts

| Command            | Description                  |
|--------------------|------------------------------|
| `npm run dev`      | Start dev server             |
| `npm run build`    | Production build             |
| `npm run db:migrate` | Run Prisma migrations      |
| `npm run db:seed`  | Seed database with demo data |
| `npm run db:studio`| Open Prisma Studio           |
