# Financial Management System

A comprehensive financial management system for associations built with Next.js, TypeScript, Tailwind CSS, Mantine UI, and Prisma.

## Features

- 🔐 **Authentication & Authorization**: User registration with admin approval, role-based access control
- 👥 **Member Management**: Complete CRUD operations for member profiles
- 💰 **Financial Management**: Track dues, levies, donations, and penalties
- 📊 **Accounting System**: Income/expense tracking with approval workflows
- 📈 **Professional Reports**: Generate PDF and Excel reports with custom branding
- 📤 **Export System**: Individual and bulk member data exports with filtering
- 🔔 **Notifications**: Email notifications via Resend
- ⚡ **Performance**: Redis caching for optimal performance

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **UI Framework**: Tailwind CSS with Mantine UI components
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with HTTP-only cookies
- **Email**: Resend
- **Caching**: Redis (Upstash for dev, VPS for production)
- **Charts**: Recharts
- **Exports**: jsPDF/Puppeteer (PDF), ExcelJS (Excel)

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Redis server (optional but recommended)

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd financial-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
# Database (use Neon for development)
DATABASE_URL="postgresql://username:password@localhost:5432/financial_management"
NEON_DATABASE_URL="postgresql://username:password@neon-host/financial_management"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Email Service (Resend)
RESEND_API_KEY="your-resend-api-key"
FROM_EMAIL="noreply@yourdomain.com"

# Redis (optional)
REDIS_URL="redis://localhost:6379"
UPSTASH_REDIS_URL="your-upstash-redis-url"
UPSTASH_REDIS_TOKEN="your-upstash-redis-token"

# JWT
JWT_SECRET="your-jwt-secret-key"
```

### Database Setup

1. Generate Prisma client:
```bash
npm run db:generate
```

2. Push the schema to your database:
```bash
npm run db:push
```

3. (Optional) View your database in Prisma Studio:
```bash
npm run db:studio
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
financial-management-system/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   ├── auth/              # Authentication pages
│   │   ├── dashboard/         # Dashboard pages
│   │   └── layout.tsx         # Root layout
│   ├── components/            # Reusable components
│   │   ├── auth/              # Authentication components
│   │   ├── common/            # Shared components
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── members/           # Member management
│   │   ├── finances/          # Financial components
│   │   └── reports/           # Reporting components
│   ├── lib/                   # Library functions
│   │   ├── prisma.ts          # Prisma client
│   │   └── auth.ts            # Auth utilities
│   ├── store/                 # Zustand stores
│   │   ├── authStore.ts       # Authentication state
│   │   ├── memberStore.ts     # Member management state
│   │   └── financeStore.ts    # Financial data state
│   ├── types/                 # TypeScript types
│   ├── utils/                 # Utility functions
│   └── hooks/                 # Custom React hooks
├── prisma/
│   └── schema.prisma          # Database schema
├── public/                    # Static assets
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## User Roles

- **Super Admin**: Full system access
- **Admin**: User management, approvals, financial oversight
- **Treasurer**: Financial operations, report generation
- **Financial Secretary**: Transaction recording, payment tracking
- **Member**: View personal information and payment history

## Default Users

After setting up the database, you'll need to manually create an admin user in the database or use the registration flow and then manually approve the first admin user.

## Features Implementation Status

### Phase 1: Project Foundation ✅
- [x] Next.js project setup with TypeScript
- [x] Tailwind CSS and Mantine UI configuration
- [x] Prisma database schema
- [x] Authentication system with JWT
- [x] User registration with approval workflow
- [x] Basic project structure and utilities

### Upcoming Phases
- [ ] Phase 2: Member Management (Week 3)
- [ ] Phase 3: Financial Management Core (Week 4-5)
- [ ] Phase 4: Advanced Features (Week 6)
- [ ] Phase 5: Reporting System (Week 7)
- [ ] And more... (see implementation.md for full roadmap)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.