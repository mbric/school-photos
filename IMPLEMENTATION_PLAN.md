# School Photo Management System — Implementation Plan

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 14 (App Router) | Fullstack React framework — handles UI, API routes, and SSR in one project |
| **Language** | TypeScript | Type safety across frontend and backend |
| **Database** | SQLite via Prisma ORM | Simple file-based DB, no server to manage. Prisma gives us migrations, type-safe queries, and easy swap to PostgreSQL later if needed |
| **Auth** | Custom email + password | bcrypt password hashing, JWT session tokens stored in HTTP-only cookies |
| **Realtime** | WebSockets (Socket.io) | Bidirectional real-time sync between photographer and helper devices on shoot day |
| **Offline** | Service Worker + IndexedDB | PWA approach — cache shoot UI, store check-ins locally, sync when back online |
| **Photo Storage** | TBD (abstracted) | Build behind a storage interface so we can plug in S3, R2, or local filesystem later |
| **Payments** | Stripe | Well-documented, supports Venmo via Link, handles PCI compliance |
| **Email** | Resend or Nodemailer | Transactional emails for proof links and order confirmations |
| **Styling** | Tailwind CSS + shadcn/ui | Utility-first CSS with polished, accessible component library |
| **Barcode/QR** | html5-qrcode | Client-side camera-based QR/barcode scanning |
| **Hosting** | TBD | Designed to deploy to Vercel, Railway, or self-hosted Docker |

---

## Project Structure

```
school-photos/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Auto-generated migrations
│   └── seed.ts                # Development seed data
├── public/
│   ├── sw.js                  # Service worker for offline support
│   └── manifest.json          # PWA manifest
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/       # Photographer dashboard (protected)
│   │   │   ├── layout.tsx     # Dashboard shell with sidebar nav
│   │   │   ├── page.tsx       # Home: upcoming events, alerts
│   │   │   ├── schools/
│   │   │   │   ├── page.tsx           # School list
│   │   │   │   ├── new/page.tsx       # Create school
│   │   │   │   └── [schoolId]/
│   │   │   │       ├── page.tsx       # School detail
│   │   │   │       ├── roster/page.tsx # Roster management
│   │   │   │       └── events/        # Picture days for this school
│   │   │   ├── events/
│   │   │   │   └── [eventId]/
│   │   │   │       ├── page.tsx       # Event detail & planning
│   │   │   │       ├── shoot/page.tsx  # Shoot day live workflow
│   │   │   │       ├── photos/page.tsx # Photo upload & matching
│   │   │   │       ├── proofs/page.tsx # Proof link management
│   │   │   │       └── orders/page.tsx # Order management
│   │   │   ├── orders/page.tsx        # Global order dashboard
│   │   │   └── reports/page.tsx       # Reports & analytics
│   │   ├── (parent)/          # Parent-facing pages (public, no auth)
│   │   │   └── proof/
│   │   │       └── [token]/
│   │   │           ├── page.tsx       # Proof gallery
│   │   │           └── order/page.tsx # Package selection & checkout
│   │   └── api/               # API routes
│   │       ├── auth/
│   │       ├── schools/
│   │       ├── students/
│   │       ├── events/
│   │       ├── shoot/         # Shoot day endpoints
│   │       ├── photos/
│   │       ├── proofs/
│   │       ├── orders/
│   │       ├── payments/      # Stripe webhook + checkout
│   │       └── socket/        # WebSocket upgrade handler
│   ├── components/
│   │   ├── ui/                # shadcn/ui base components
│   │   ├── forms/             # Form components (CSV import, school form, etc.)
│   │   ├── shoot/             # Shoot day components (checklist, scanner, progress)
│   │   ├── photos/            # Photo upload, matching, review components
│   │   ├── proofs/            # Parent-facing gallery components
│   │   └── orders/            # Order & checkout components
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── auth.ts            # Auth utilities (hash, verify, JWT, middleware)
│   │   ├── storage.ts         # Photo storage interface (abstract)
│   │   ├── storage/
│   │   │   ├── local.ts       # Local filesystem storage adapter
│   │   │   └── s3.ts          # S3-compatible storage adapter
│   │   ├── email.ts           # Email sending utilities
│   │   ├── csv.ts             # CSV parsing and column mapping
│   │   ├── matching.ts        # Photo-to-student matching logic
│   │   ├── tokens.ts          # Proof link token generation
│   │   ├── offline.ts         # IndexedDB helpers for offline sync
│   │   └── socket.ts          # Socket.io client/server setup
│   ├── hooks/                 # React hooks
│   │   ├── useSocket.ts       # WebSocket connection hook
│   │   ├── useOfflineSync.ts  # Offline queue + sync hook
│   │   └── useScanner.ts      # QR/barcode scanner hook
│   └── types/                 # Shared TypeScript types
│       └── index.ts
├── .env.local                 # Environment variables
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── REQUIREMENTS.md
```

---

## Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // file:./dev.db
}

// ─── Auth ─────────────────────────────────────────────

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String
  role          String   @default("photographer") // photographer | helper
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  schools       School[]
  events        Event[]
}

// ─── School & Roster ──────────────────────────────────

model School {
  id             String   @id @default(cuid())
  name           String
  address        String?
  contactName    String?
  contactEmail   String?
  contactPhone   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  photographerId String
  photographer   User     @relation(fields: [photographerId], references: [id])

  students       Student[]
  events         Event[]
  packages       Package[]
}

model Student {
  id           String   @id @default(cuid())
  firstName    String
  lastName     String
  grade        String
  teacher      String?  // class/teacher name
  studentId    String?  // school-assigned ID
  parentEmail  String?
  familyId     String?  // links siblings together
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  schoolId     String
  school       School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  checkIns     CheckIn[]
  photos       Photo[]
  proofLinks   ProofLink[]
  orderItems   OrderItem[]

  @@index([schoolId, grade, teacher])
  @@index([familyId])
  @@index([studentId, schoolId])
}

// ─── Picture Day Events ───────────────────────────────

model Event {
  id              String   @id @default(cuid())
  type            String   @default("initial") // initial | retake
  date            DateTime
  startTime       String?  // e.g. "08:30"
  notes           String?
  classOrder      String?  // JSON: ordered list of grade/teacher combos
  status          String   @default("scheduled") // scheduled | in_progress | completed
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  schoolId        String
  school          School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  photographerId  String
  photographer    User     @relation(fields: [photographerId], references: [id])

  checkIns        CheckIn[]
  photos          Photo[]
  proofLinks      ProofLink[]
  orders          Order[]

  @@index([schoolId])
  @@index([date])
}

// ─── Shoot Day ────────────────────────────────────────

model CheckIn {
  id          String   @id @default(cuid())
  status      String   @default("pending") // pending | photographed | absent | retake
  sequence    Int?     // order in which they were photographed
  notes       String?
  checkedInAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  studentId   String
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  eventId     String
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([studentId, eventId])
  @@index([eventId, status])
}

// ─── Photos ───────────────────────────────────────────

model Photo {
  id            String   @id @default(cuid())
  filename      String
  storagePath   String   // path in storage provider
  thumbnailPath String?
  mimeType      String   @default("image/jpeg")
  fileSize      Int?
  sequence      Int?     // upload order, used for auto-matching
  matched       Boolean  @default(false)
  flagged       Boolean  @default(false)
  flagReason    String?
  createdAt     DateTime @default(now())

  eventId       String
  event         Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  studentId     String?
  student       Student? @relation(fields: [studentId], references: [id])

  orderItems    OrderItem[]

  @@index([eventId, matched])
  @@index([studentId])
}

// ─── Proofs ───────────────────────────────────────────

model ProofLink {
  id           String    @id @default(cuid())
  token        String    @unique // unguessable URL token
  accessCode   String?   // optional PIN for extra security
  familyId     String?   // if set, shows all siblings
  expiresAt    DateTime?
  viewCount    Int       @default(0)
  lastViewedAt DateTime?
  emailSentAt  DateTime?
  createdAt    DateTime  @default(now())

  eventId      String
  event        Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  studentId    String?   // null if familyId is used
  student      Student?  @relation(fields: [studentId], references: [id])

  @@index([token])
  @@index([eventId])
}

// ─── Orders & Packages ────────────────────────────────

model Package {
  id          String   @id @default(cuid())
  name        String   // e.g. "Basic Package"
  description String?
  price       Int      // price in cents
  contents    String   // JSON: [{ "type": "print", "size": "8x10", "qty": 1 }, ...]
  digital     Boolean  @default(false) // includes digital download?
  active      Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  schoolId    String
  school      School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  orderItems  OrderItem[]
}

model Order {
  id              String   @id @default(cuid())
  orderNumber     String   @unique // human-readable: SP-2026-0001
  status          String   @default("pending") // pending | paid | sent_to_lab | printed | delivered
  source          String   @default("online") // online | paper
  totalAmount     Int      // in cents
  stripePaymentId String?
  parentEmail     String?
  parentName      String?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  eventId         String
  event           Event    @relation(fields: [eventId], references: [id])

  items           OrderItem[]
  downloads       DigitalDownload[]
}

model OrderItem {
  id         String  @id @default(cuid())
  quantity   Int     @default(1)
  unitPrice  Int     // in cents, snapshot at time of order

  orderId    String
  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  packageId  String
  package    Package @relation(fields: [packageId], references: [id])
  studentId  String
  student    Student @relation(fields: [studentId], references: [id])
  photoId    String?
  photo      Photo?  @relation(fields: [photoId], references: [id])
}

model DigitalDownload {
  id           String    @id @default(cuid())
  token        String    @unique
  downloadUrl  String?   // signed URL, generated on demand
  expiresAt    DateTime
  downloadedAt DateTime?
  createdAt    DateTime  @default(now())

  orderId      String
  order        Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```

---

## Implementation Phases

### Phase 1: Foundation & Auth
**Goal:** Project scaffolding, database, authentication, basic layout.

| Task | Details |
|------|---------|
| 1.1 Initialize project | `create-next-app` with TypeScript, Tailwind, App Router |
| 1.2 Set up Prisma + SQLite | Install Prisma, define schema, run initial migration |
| 1.3 Install shadcn/ui | Base component library + theme configuration |
| 1.4 Build auth system | Registration, login, logout. bcrypt hashing, JWT in HTTP-only cookies |
| 1.5 Auth middleware | Next.js middleware to protect `/dashboard/*` routes |
| 1.6 Dashboard layout | Sidebar navigation shell, responsive mobile menu |
| 1.7 Seed script | Sample school, students, and event data for development |

**Deliverable:** Photographer can register, log in, and see an empty dashboard.

---

### Phase 2: School & Roster Management (Epic 1)
**Goal:** CRUD for schools and students, CSV import with column mapping.

| Task | Details |
|------|---------|
| 2.1 School CRUD | Create, edit, list, delete schools |
| 2.2 Student CRUD | Add, edit, delete individual students |
| 2.3 CSV import engine | Parse CSV, preview data, flexible column mapping UI |
| 2.4 Import validation | Detect missing names, duplicate student IDs, surface errors |
| 2.5 Roster view | Filterable table by grade/teacher, search, bulk actions |
| 2.6 Sibling linking | Auto-link by parent email or last name; manual link/unlink UI |

**Deliverable:** Photographer can create schools, import rosters via CSV, and manage student records.

---

### Phase 3: Picture Day Scheduling (Epic 2)
**Goal:** Schedule events, configure class order, generate shot lists.

| Task | Details |
|------|---------|
| 3.1 Event CRUD | Create picture day (date, time, type, notes) linked to a school |
| 3.2 Class order editor | Drag-and-drop interface to set grade/teacher shooting order |
| 3.3 Shot list view | Printable shot list organized by class order |
| 3.4 Dashboard calendar | Upcoming events on the home dashboard |
| 3.5 Retake day support | Create retake event pre-populated with absent/flagged students |

**Deliverable:** Photographer can schedule picture days, set class order, and print shot lists.

---

### Phase 4: Shoot Day Workflow (Epic 3)
**Goal:** Real-time shoot day interface with check-in, scanning, progress, and multi-device sync.

| Task | Details |
|------|---------|
| 4.1 Shoot day UI | Mobile-first class checklist with student cards and status buttons |
| 4.2 Check-in logic | Mark students as photographed, absent, or retake; track sequence numbers |
| 4.3 QR/barcode scanner | Camera-based scanning using html5-qrcode; auto-lookup student by ID |
| 4.4 Walk-up students | Quick-add form for unrostered students during a shoot |
| 4.5 Progress dashboard | Per-class and whole-school completion stats, real-time counters |
| 4.6 WebSocket sync | Socket.io server + client. Broadcast check-in changes to all connected devices |
| 4.7 Helper role | Shareable session link for helpers; restricted to check-in actions only |
| 4.8 Offline support | Service worker caches shoot UI; IndexedDB stores check-ins offline; background sync on reconnect |

**Deliverable:** Photographer and helper can run a shoot day from their phones with real-time sync and offline resilience.

---

### Phase 5: Photo Upload & Matching (Epic 4)
**Goal:** Bulk upload, auto-match photos to students, manual review.

| Task | Details |
|------|---------|
| 5.1 Storage interface | Abstract storage layer with local filesystem adapter (S3 adapter stubbed) |
| 5.2 Bulk upload | Drag-and-drop or folder select; chunked uploads with progress bars |
| 5.3 Thumbnail generation | Server-side thumbnail creation on upload (sharp library) |
| 5.4 Auto-matching | Match photos to students by filename convention or shoot sequence order |
| 5.5 Review interface | Side-by-side view: student info + matched photo thumbnail; approve/reassign |
| 5.6 Unmatched queue | Dedicated view for unmatched/flagged photos with drag-to-assign |
| 5.7 Multiple poses | Support multiple photos per student; mark preferred pose |

**Deliverable:** Photographer can upload a shoot's photos and match them to students efficiently.

---

### Phase 6: Parent Proofs (Epic 5)
**Goal:** Generate proof links, send emails, parent gallery with pose selection.

| Task | Details |
|------|---------|
| 6.1 Token generation | Cryptographically random, unguessable proof URL tokens |
| 6.2 Proof link management | Generate links per student or per family (sibling grouping); set expiration |
| 6.3 Bulk email sending | Send proof link emails to all parents for an event |
| 6.4 Parent gallery UI | Public, no-auth gallery page; mobile-friendly photo viewer |
| 6.5 Access code gate | Optional PIN entry before viewing proofs |
| 6.6 Pose preference | Parents can tap to select favorite pose per child |
| 6.7 Family view | Single proof link shows all siblings' photos together |

**Deliverable:** Parents receive an email, click a link, view their child's photos, and select a preferred pose.

---

### Phase 7: Orders & Payments (Epic 6)
**Goal:** Package configuration, online ordering, Stripe checkout, order management.

| Task | Details |
|------|---------|
| 7.1 Package configuration | CRUD for photo packages per school; set contents, pricing, sort order |
| 7.2 Order placement UI | Parent selects package from proof page; adds to cart; multi-child ordering |
| 7.3 Stripe integration | Checkout Session for payments; webhook for payment confirmation |
| 7.4 Order confirmation | Email receipt to parent on successful payment |
| 7.5 Digital downloads | Generate time-limited signed download URLs for digital packages |
| 7.6 Order dashboard | Photographer view: all orders, filter by school/event/status, search |
| 7.7 Order status tracking | Update status through fulfillment pipeline (paid → sent to lab → printed → delivered) |
| 7.8 Lab export | Export order CSV in configurable format for print lab submission |
| 7.9 Paper order entry | Photographer can manually enter paper order forms into the system |

**Deliverable:** Parents can order and pay online. Photographer can manage and fulfill orders.

---

### Phase 8: Reporting & Polish (Epic 7)
**Goal:** Reports, dashboard improvements, and production readiness.

| Task | Details |
|------|---------|
| 8.1 Home dashboard | Upcoming events, recent orders, alerts (unmatched photos, missing students) |
| 8.2 Missing student report | Per-event list of absent/no-photo students for retake planning |
| 8.3 Revenue report | Order totals per school/event and overall; charts |
| 8.4 CSV export | Export any report/table to CSV |
| 8.5 Error handling | Global error boundaries, toast notifications, form validation polish |
| 8.6 Loading states | Skeleton loaders, optimistic updates for shoot day |
| 8.7 PWA manifest | App icon, splash screen, installability for shoot day use |
| 8.8 Accessibility | ARIA labels, keyboard navigation, contrast checks on parent-facing pages |

**Deliverable:** Polished, production-ready application with reporting and analytics.

---

## Key Technical Decisions

### Authentication Flow
```
Register → bcrypt hash password → store in DB
Login → verify password → issue JWT (24h expiry) → set HTTP-only cookie
Middleware → verify JWT on every /dashboard/* request → reject or continue
```

### Offline Sync Strategy
```
Online:  API call → update server DB → broadcast via WebSocket → update UI
Offline: Action → store in IndexedDB queue → update local UI optimistically
Reconnect: Drain IndexedDB queue → POST each action to server → resolve conflicts by timestamp
```

### Photo Matching Algorithm
1. **Filename match:** If photo filename contains a student ID (e.g., `STU-1234-001.jpg`), match directly
2. **Sequence match:** Sort photos by filename/EXIF timestamp; match to students in check-in sequence order
3. **Fallback:** Place in unmatched queue for manual assignment

### Proof Link Security
- Token: 32-byte random hex string (e.g., `a3f8c1...`) — 2^128 possible values
- Optional access code: 6-digit numeric PIN
- Expiration: configurable per event (default 30 days)
- No parent account required — stateless access

### Payment Flow (Stripe)
```
Parent selects package → Create Stripe Checkout Session → Redirect to Stripe
Stripe processes payment → Webhook POST to /api/payments/webhook
Webhook handler → verify signature → update order status to "paid"
If digital package → generate download links → email to parent
```

---

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="random-secret-here"

# Storage (when S3 is configured)
STORAGE_PROVIDER="local"  # local | s3
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY=""
S3_SECRET_KEY=""

# Email
EMAIL_PROVIDER="resend"  # resend | smtp
RESEND_API_KEY=""
EMAIL_FROM="photos@yourdomain.com"

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "prisma": "^5",
    "@prisma/client": "^5",
    "bcryptjs": "^2",
    "jsonwebtoken": "^9",
    "socket.io": "^4",
    "socket.io-client": "^4",
    "stripe": "^14",
    "sharp": "^0.33",
    "html5-qrcode": "^2",
    "papaparse": "^5",
    "nanoid": "^5",
    "resend": "^2",
    "tailwindcss": "^3",
    "@tailwindcss/forms": "^0.5",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "lucide-react": "^0.300",
    "idb": "^8",
    "date-fns": "^3",
    "zod": "^3",
    "react-dropzone": "^14",
    "@dnd-kit/core": "^6",
    "@dnd-kit/sortable": "^8"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^18",
    "@types/node": "^20",
    "@types/bcryptjs": "^2",
    "@types/jsonwebtoken": "^9"
  }
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| SQLite concurrency limits | Fine for solo photographer (10-20 schools). Schema designed for easy Prisma migration to PostgreSQL if needed. |
| Offline sync conflicts | Timestamp-based last-write-wins with conflict log. Check-in actions are idempotent (same student + event = upsert). |
| Photo storage size | Thumbnails served to UI; full-res only for downloads. Storage interface allows swapping to S3 without code changes. |
| Stripe webhook reliability | Idempotent webhook handler keyed on payment intent ID. Order status only advances forward (never regresses). |
| Parent proof link security | 128-bit random tokens + optional PIN. Rate limiting on proof access. Links expire. |

---

## Build Order Summary

```
Phase 1: Foundation & Auth           ← Start here
Phase 2: School & Roster Management  ← Core data model
Phase 3: Picture Day Scheduling      ← Planning workflow
Phase 4: Shoot Day Workflow          ← The "big day" — complex, high value
Phase 5: Photo Upload & Matching     ← Post-shoot processing
Phase 6: Parent Proofs               ← Parent-facing sharing
Phase 7: Orders & Payments           ← Revenue generation
Phase 8: Reporting & Polish          ← Final refinements
```

Each phase produces a usable increment. The photographer can start using the system after Phase 4 for shoot management, even before proofs and ordering are built.
