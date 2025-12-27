# Shared Packages

Common TypeScript types, validators, and utilities shared across the monorepo.

## Packages

### `@societyledger/shared`

Shared types and Zod validators used by both frontend and backend.

## Usage

```typescript
// In apps/web or apps/api
import { User, LoginInput, ApiResponse } from '@societyledger/shared';
import { loginSchema, registerSchema } from '@societyledger/shared';

// Use types
const user: User = {
  id: '123',
  email: 'user@example.com',
  role: 'member',
  isActive: true
};

// Validate input
const result = loginSchema.parse({
  email: 'test@example.com',
  password: 'password123'
});
```

## Adding New Types

1. Add types to `packages/shared/src/types.ts`
2. Export from `packages/shared/src/index.ts`
3. Types are automatically available in all apps

## Adding New Validators

1. Add Zod schemas to `packages/shared/src/validators.ts`
2. Export from `packages/shared/src/index.ts`
3. Use in both frontend and backend

## Structure

```
packages/shared/
├── src/
│   ├── types.ts       # TypeScript interfaces
│   ├── validators.ts  # Zod schemas
│   └── index.ts       # Exports
├── package.json
└── tsconfig.json
```

## Benefits

- **Type Safety:** Same types across frontend and backend
- **DRY:** Define once, use everywhere
- **Validation:** Shared Zod schemas ensure consistent validation
- **Refactoring:** Change in one place updates everywhere
