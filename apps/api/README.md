# SocietyLedger API

Express.js backend API for SocietyLedger SaaS platform.

## Stack

- **Framework:** Express.js 4.x + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT with HTTP-only cookies
- **Validation:** Zod
- **Security:** Helmet, CORS, Rate limiting

## Development

```bash
# Install dependencies (from project root)
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start dev server (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Start production server
npm run start

# Open Prisma Studio
npm run db:studio
```

## Environment Variables

Create `.env`:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/societyledger
JWT_SECRET=your-super-secret-jwt-key-change-this
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=your-resend-api-key
```

## Project Structure

```
src/
├── server.ts              # Express app entry
├── lib/
│   ├── prisma.ts         # Prisma client
│   └── auth.ts           # JWT utilities
├── middleware/
│   └── auth.middleware.ts # JWT verification
└── modules/
    └── auth/
        ├── auth.controller.ts  # Request handlers
        └── auth.routes.ts      # Route definitions
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user (protected)

### Health
- `GET /health` - API health check

## Adding New Features

1. Create a new module in `src/modules/`:
```
src/modules/members/
├── members.controller.ts
├── members.service.ts
├── members.routes.ts
└── members.types.ts
```

2. Register routes in `src/server.ts`:
```typescript
import memberRoutes from './modules/members/members.routes';
app.use('/api/members', authMiddleware, memberRoutes);
```

## Database Migrations

```bash
# Create a migration
npm run db:migrate

# Apply migrations
npm run db:push

# Reset database (caution!)
npx prisma migrate reset
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Security

- CORS configured for frontend URL only
- JWT tokens with 7-day expiration
- HTTP-only cookies (not accessible via JavaScript)
- Helmet security headers
- Rate limiting per IP
- SQL injection prevention via Prisma

## Notes

- All routes should be in feature-based modules
- Use Prisma for all database operations
- Validate all inputs with Zod schemas
- Follow RESTful conventions
