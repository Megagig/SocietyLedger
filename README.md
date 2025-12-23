# SocietyLedger - Multi-Tenant SaaS Platform

A comprehensive SaaS platform for association management (HOAs, cooperatives, town unions, clubs, religious bodies) across Africa, built with the PERN stack in a modern monorepo architecture.

## 🏗️ Architecture

**PERN Monorepo** (PostgreSQL, Express, React/Next.js, Node.js)

```
societyledger/
├── apps/
│   ├── web/          # Next.js 14 Frontend (Port 3000)
│   ├── api/          # Express.js Backend (Port 4000)
│   └── jobs/         # BullMQ Background Workers (Coming soon)
├── packages/
│   ├── shared/       # Shared types & validators
│   └── config/       # Shared configs (Coming soon)
└── turbo.json        # Turborepo configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm 10+

### Installation

```bash
# Install all dependencies
npm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Update database connection in apps/api/.env
# DATABASE_URL="postgresql://user:password@localhost:5432/societyledger"

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push
```

### Development

```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run web:dev    # Frontend only (http://localhost:3000)
npm run api:dev    # Backend only (http://localhost:4000)
```

### Database Commands

```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:migrate     # Create a new migration
npm run db:studio      # Open Prisma Studio
```

## 📦 Tech Stack

### Frontend (`apps/web`)
- **Framework:** Next.js 14 (App Router)
- **UI Library:** Mantine UI 7.0 + Tailwind CSS
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod validation
- **HTTP Client:** Axios

### Backend (`apps/api`)
- **Framework:** Express.js 4.x + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Authentication:** JWT with HTTP-only cookies
- **Validation:** Zod
- **Security:** Helmet, CORS, Rate limiting

### Shared (`packages/shared`)
- TypeScript types
- Zod validation schemas
- Shared utilities

## 🔐 Authentication Flow

1. User submits credentials to frontend
2. Frontend calls `POST /api/auth/login` on Express backend
3. Backend validates credentials, generates JWT
4. JWT stored in HTTP-only cookie + returned in response
5. Subsequent requests include cookie automatically
6. Backend middleware verifies JWT on protected routes

## 📁 Project Structure

### Frontend (`apps/web/src/`)
```
src/
├── app/              # Next.js App Router pages
│   ├── auth/        # Login, register pages
│   ├── dashboard/   # Protected dashboard pages
│   ├── layout.tsx   # Root layout
│   └── page.tsx     # Home page
├── components/       # React components
├── lib/
│   └── api-client.ts # Axios client for backend
├── store/           # Zustand stores
├── types/           # TypeScript types
└── utils/           # Utility functions
```

### Backend (`apps/api/src/`)
```
src/
├── server.ts        # Express app entry point
├── lib/
│   ├── prisma.ts    # Prisma client
│   └── auth.ts      # JWT utilities
├── middleware/
│   └── auth.middleware.ts  # JWT verification
└── modules/
    └── auth/
        ├── auth.controller.ts  # Request handlers
        └── auth.routes.ts      # Route definitions
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user (protected)

### Health Check
- `GET /health` - API health check

## 🔧 Environment Variables

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=SocietyLedger
```

### Backend (`apps/api/.env`)
```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/societyledger
JWT_SECRET=your-super-secret-jwt-key-change-this
```

## 📋 Available Scripts

### Root
- `npm run dev` - Start all apps
- `npm run build` - Build all apps
- `npm run lint` - Lint all apps
- `npm run type-check` - Type check all apps

### Frontend (apps/web)
- `npm run dev -w apps/web` - Start dev server
- `npm run build -w apps/web` - Build for production
- `npm run start -w apps/web` - Start production server

### Backend (apps/api)
- `npm run dev -w apps/api` - Start dev server (tsx watch)
- `npm run build -w apps/api` - Build TypeScript to JS
- `npm run start -w apps/api` - Start production server

## 🚧 Roadmap

See [plan.md](plan.md) for detailed implementation roadmap.

### Current Status: Phase 0.5 Complete ✅
- [x] Monorepo setup with Turborepo
- [x] Express backend with modular architecture
- [x] Next.js frontend (UI only, no API routes)
- [x] Shared TypeScript types
- [x] Authentication system migrated
- [ ] Multi-tenancy implementation (Phase 0)
- [ ] Subscription & billing (Phase 1.5)
- [ ] All remaining features (Phases 2-17)

## 🤝 Contributing

This is a private project. For development team members:

1. Create a feature branch: `git flow feature start feature-name`
2. Make changes and commit
3. Push and create a pull request
4. Wait for review and approval

## 📝 License

Proprietary - All rights reserved

## 👥 Team

SocietyLedger Development Team

---

**Last Updated:** December 23, 2025  
**Current Phase:** Phase 0.5 (PERN Refactoring) - Complete  
**Next Phase:** Phase 0 (Multi-tenancy Architecture)
