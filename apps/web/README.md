# SocietyLedger Web App

Next.js 14 frontend application for SocietyLedger SaaS platform.

## Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** Mantine UI 7.0 + Tailwind CSS
- **State:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod
- **HTTP:** Axios

## Development

```bash
# Install dependencies (from project root)
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=SocietyLedger
```

## Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── auth/        # Authentication pages
│   ├── dashboard/   # Protected dashboard
│   ├── layout.tsx
│   └── page.tsx
├── components/       # React components
├── lib/
│   └── api-client.ts # Backend API client
├── store/           # Zustand stores
├── types/           # TypeScript types
└── utils/           # Utilities
```

## API Communication

All API calls go through `src/lib/api-client.ts` which connects to the Express backend at `http://localhost:4000`.

## Available Routes

- `/` - Home page
- `/auth/login` - Login page
- `/auth/register` - Registration page
- `/dashboard` - Protected dashboard (requires auth)

## Notes

- No API routes in this app (all backend logic in `apps/api`)
- Uses HTTP-only cookies for authentication
- Communicates with Express backend via Axios
