# Phase 23: Dashboard Separation - Developer Guide

**For:** Developers working on the SocietyLedger platform  
**Date:** January 10, 2026  
**Version:** 1.0

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Basic understanding of Next.js 14 (App Router)
- Familiarity with React hooks
- Understanding of RBAC (Role-Based Access Control)

### Development Setup

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
cd societyledger
npm install

# Start development server
npm run dev

# Open browser
# Navigate to http://localhost:3000
```

---

## Architecture Overview

### Key Files

```
apps/web/src/
├── app/dashboard/
│   ├── page.tsx                    # Smart redirect logic
│   ├── member/                     # Member routes
│   └── admin/                      # Admin routes
│
├── components/layout/
│   ├── AuthenticatedLayout.tsx     # Main layout with sidebar selection
│   ├── MemberSidebar.tsx           # Member navigation
│   ├── AdminSidebar.tsx            # Admin dual-section navigation
│   ├── SectionDivider.tsx          # Visual separator
│   ├── Breadcrumbs.tsx             # Navigation breadcrumbs
│   └── RoleIndicator.tsx           # Context badge
│
└── lib/
    └── permissions.ts              # RBAC system
```

---

## Adding New Navigation Items

### To Member Sidebar

**File:** `apps/web/src/components/layout/MemberSidebar.tsx`

```typescript
// 1. Add to navItems array
const navItems: NavItem[] = [
  // ... existing items
  {
    label: 'My New Feature',
    icon: <IconNewFeature size={20} />,
    href: '/dashboard/member/new-feature',
    // Optional: Add children for expandable section
    children: [
      {
        label: 'Sub Feature',
        icon: <IconSub size={18} />,
        href: '/dashboard/member/new-feature/sub',
      },
    ],
  },
];

// 2. Import the icon
import { IconNewFeature, IconSub } from '@tabler/icons-react';

// 3. Create the route
// File: apps/web/src/app/dashboard/member/new-feature/page.tsx
export default function NewFeaturePage() {
  return <div>New Feature Content</div>;
}
```

### To Admin Sidebar

**File:** `apps/web/src/components/layout/AdminSidebar.tsx`

```typescript
// Choose section: memberNavItems or adminNavItems

// For Member Area (admin's personal features)
const memberNavItems: NavItem[] = [
  // ... existing items
  {
    label: 'My New Feature',
    icon: <IconNewFeature size={20} />,
    href: '/dashboard/member/new-feature',
  },
];

// For Administration (association management)
const adminNavItems: NavItem[] = [
  // ... existing items
  {
    label: 'New Management Feature',
    icon: <IconManagement size={20} />,
    permission: PERMISSIONS.NEW_FEATURE_VIEW,
    children: [
      {
        label: 'Sub Feature',
        icon: <IconSub size={18} />,
        href: '/dashboard/admin/new-feature/sub',
        permission: PERMISSIONS.NEW_FEATURE_MANAGE,
      },
    ],
  },
];
```

---

## Permission System

### Adding New Permissions

**File:** `apps/web/src/lib/permissions.ts`

```typescript
export const PERMISSIONS = {
  // ... existing permissions
  
  // New Feature Permissions
  NEW_FEATURE_VIEW: 'new_feature.view',
  NEW_FEATURE_CREATE: 'new_feature.create',
  NEW_FEATURE_EDIT: 'new_feature.edit',
  NEW_FEATURE_DELETE: 'new_feature.delete',
} as const;
```

### Using Permissions in Components

```typescript
import { hasPermission, PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';

function MyComponent() {
  const { user } = useAuthStore();
  const userPermissions = user?.permissions || [];
  
  // Check single permission
  const canView = hasPermission(userPermissions, PERMISSIONS.NEW_FEATURE_VIEW);
  
  // Check multiple permissions (any)
  const canManage = hasAnyPermission(userPermissions, [
    PERMISSIONS.NEW_FEATURE_CREATE,
    PERMISSIONS.NEW_FEATURE_EDIT,
  ]);
  
  // Check multiple permissions (all)
  const canFullAccess = hasAllPermissions(userPermissions, [
    PERMISSIONS.NEW_FEATURE_VIEW,
    PERMISSIONS.NEW_FEATURE_EDIT,
  ]);
  
  return (
    <div>
      {canView && <ViewFeature />}
      {canManage && <ManageFeature />}
    </div>
  );
}
```

### Permission Checks in Sidebar

```typescript
// In navItems definition
{
  label: 'Protected Feature',
  icon: <IconLock size={20} />,
  href: '/dashboard/protected',
  permission: PERMISSIONS.PROTECTED_VIEW, // Single permission
  // OR
  permission: [PERMISSIONS.PROTECTED_VIEW, PERMISSIONS.ADMIN_VIEW], // Multiple (any)
  // OR
  roleRequired: 'admin', // Specific role required
  // OR
  hideForSuperAdmin: true, // Hide for super admins
}
```

---

## Creating New Dashboard Pages

### Member Dashboard Page

```typescript
// File: apps/web/src/app/dashboard/member/my-feature/page.tsx
'use client';

import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';

export default function MyFeaturePage() {
  const { user } = useAuthStore();
  
  // Fetch data
  const { data, isLoading } = useQuery({
    queryKey: ['my-feature', user?.id],
    queryFn: () => fetch('/api/my-feature').then(res => res.json()),
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
          My Feature
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Feature description
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Your content */}
      </div>
    </>
  );
}
```

### Admin Dashboard Page

```typescript
// File: apps/web/src/app/dashboard/admin/feature/page.tsx
'use client';

import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default function AdminFeaturePage() {
  const { user } = useAuthStore();
  const userPermissions = user?.permissions || [];
  
  // Check permissions
  if (!hasPermission(userPermissions, PERMISSIONS.FEATURE_VIEW)) {
    return <div>Access Denied</div>;
  }
  
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          Admin Feature
        </h1>
      </div>
      
      {/* Admin content */}
    </>
  );
}
```

---

## Styling Guidelines

### Using Tailwind CSS

```typescript
// Glass effect (used throughout dashboard)
className="glass rounded-2xl p-6 shadow-xl"

// Gradient text (for headings)
className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent"

// Card hover effect
className="hover:shadow-2xl transition-shadow"

// Active navigation item
className="bg-gradient-to-r from-teal-500/20 to-green-500/20 text-teal-600 dark:text-teal-400"
```

### Color Palette

```css
/* Primary Colors */
--teal-500: #14b8a6
--teal-600: #0d9488
--green-500: #22c55e
--green-600: #16a34a

/* Section Colors */
--blue-500: #3b82f6    /* Member Area */
--purple-500: #a855f7  /* Administration */

/* Status Colors */
--red-500: #ef4444     /* Error, Overdue */
--orange-500: #f97316  /* Warning, Pending */
--green-500: #22c55e   /* Success, Paid */
```

---

## State Management

### Using Zustand (Auth Store)

```typescript
import { useAuthStore } from '@/store/authStore';

function MyComponent() {
  const { 
    user,              // Current user object
    isAuthenticated,   // Boolean
    isLoading,         // Boolean
    _hasHydrated,      // Boolean (important for SSR)
    checkAuth,         // Function
    logout,            // Function
  } = useAuthStore();
  
  // Always check hydration before using user data
  if (!_hasHydrated) {
    return <div>Loading...</div>;
  }
  
  return <div>Welcome, {user?.email}</div>;
}
```

### Using TanStack Query (Data Fetching)

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

function MyComponent() {
  // Fetch data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-data'],
    queryFn: () => fetch('/api/my-data').then(res => res.json()),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Mutate data
  const mutation = useMutation({
    mutationFn: (newData) => 
      fetch('/api/my-data', {
        method: 'POST',
        body: JSON.stringify(newData),
      }),
    onSuccess: () => {
      refetch(); // Refetch after mutation
    },
  });
  
  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && <div>{data.content}</div>}
    </div>
  );
}
```

---

## Routing Patterns

### Smart Redirect Pattern

```typescript
// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) return; // Wait for hydration

    if (user) {
      // Super Admin → Platform admin
      if (user.platformRole === 'SUPER_ADMIN') {
        router.replace('/admin');
        return;
      }

      // Admin → Stay on /dashboard
      if (user.role === 'admin') {
        return;
      }

      // Member → Redirect to member dashboard
      router.replace('/dashboard/member');
    }
  }, [user, _hasHydrated, router]);

  // Show loading or current dashboard
  return <div>Dashboard Content</div>;
}
```

### Protected Route Pattern

```typescript
// apps/web/src/app/dashboard/admin/protected/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

export default function ProtectedPage() {
  const router = useRouter();
  const { user, _hasHydrated } = useAuthStore();
  const userPermissions = user?.permissions || [];

  useEffect(() => {
    if (!_hasHydrated) return;

    // Check permission
    if (!hasPermission(userPermissions, PERMISSIONS.PROTECTED_VIEW)) {
      router.replace('/dashboard');
    }
  }, [user, _hasHydrated, router, userPermissions]);

  return <div>Protected Content</div>;
}
```

---

## Testing

### Unit Testing Sidebar Components

```typescript
// __tests__/components/layout/MemberSidebar.test.tsx
import { render, screen } from '@testing-library/react';
import { MemberSidebar } from '@/components/layout/MemberSidebar';

// Mock dependencies
jest.mock('@/store/authStore');
jest.mock('next/navigation');

describe('MemberSidebar', () => {
  it('renders all navigation items', () => {
    render(<MemberSidebar />);
    
    expect(screen.getByText('My Dashboard')).toBeInTheDocument();
    expect(screen.getByText('My Finances')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });
  
  it('expands sections on click', () => {
    render(<MemberSidebar />);
    
    const financeButton = screen.getByText('My Finances');
    fireEvent.click(financeButton);
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('My Ledger')).toBeInTheDocument();
  });
});
```

### Integration Testing Routes

```typescript
// __tests__/dashboard/routing.test.ts
import { render } from '@testing-library/react';
import { useRouter } from 'next/navigation';

describe('Dashboard Routing', () => {
  it('redirects super admin to /admin', () => {
    const mockRouter = { replace: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    // Mock super admin user
    mockUseAuthStore({ 
      user: { platformRole: 'SUPER_ADMIN' },
      _hasHydrated: true 
    });
    
    render(<DashboardPage />);
    
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin');
  });
});
```

---

## Common Patterns

### Expandable Navigation Item

```typescript
interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavItem[];
}

const [expandedItems, setExpandedItems] = useState<string[]>([]);

const toggleExpanded = (label: string) => {
  setExpandedItems(prev =>
    prev.includes(label)
      ? prev.filter(item => item !== label)
      : [...prev, label]
  );
};

// In render
{hasChildren ? (
  <>
    <button onClick={() => toggleExpanded(item.label)}>
      {item.label}
      <IconChevronDown 
        className={isExpanded ? 'rotate-180' : ''} 
      />
    </button>
    {isExpanded && (
      <div>
        {item.children.map(child => (
          <Link href={child.href}>{child.label}</Link>
        ))}
      </div>
    )}
  </>
) : (
  <Link href={item.href}>{item.label}</Link>
)}
```

### Active Route Highlighting

```typescript
import { usePathname } from 'next/navigation';

const pathname = usePathname();

const isActive = (href?: string) => {
  if (!href) return false;
  return pathname === href || pathname.startsWith(href + '/');
};

// In render
<Link
  href={item.href}
  className={isActive(item.href) 
    ? 'bg-teal-500/20 text-teal-600' 
    : 'text-gray-800'
  }
>
  {item.label}
</Link>
```

### Permission-Based Rendering

```typescript
const checkPermission = (permission?: string | string[]): boolean => {
  if (!permission) return true;
  
  const userPermissions = user?.permissions || [];
  
  if (Array.isArray(permission)) {
    return permission.some(p => hasPermission(userPermissions, p));
  }
  
  return hasPermission(userPermissions, permission);
};

// In render
{navItems.map(item => {
  if (!checkPermission(item.permission)) return null;
  return <NavItem key={item.label} {...item} />;
})}
```

---

## Debugging

### Common Issues

**Issue:** Hydration mismatch error

```typescript
// Solution: Always check _hasHydrated before rendering user-specific content
const { user, _hasHydrated } = useAuthStore();

if (!_hasHydrated) {
  return <div>Loading...</div>;
}

// Now safe to use user data
```

**Issue:** Permission checks not working

```typescript
// Solution: Ensure permissions are loaded from API
const { user } = useAuthStore();
const userPermissions = user?.permissions || [];

// Check if permissions are loaded
console.log('User permissions:', userPermissions);

// Fallback for admins without loaded permissions
if (userPermissions.length === 0 && user?.role === 'admin') {
  return true; // Show item
}
```

**Issue:** Route redirect loop

```typescript
// Solution: Check dependencies in useEffect
useEffect(() => {
  // Only run after hydration
  if (!_hasHydrated) return;
  
  // Your redirect logic
}, [_hasHydrated]); // Don't add user to dependencies if it causes loops
```

### Debug Tools

```typescript
// Enable debug mode
localStorage.setItem('debug', 'true');

// Log navigation state
console.log('Current pathname:', pathname);
console.log('User role:', user?.role);
console.log('User permissions:', user?.permissions);
console.log('Expanded items:', expandedItems);
```

---

## Performance Optimization

### Memoization

```typescript
import { useMemo } from 'react';

// Memoize expensive computations
const filteredItems = useMemo(() => {
  return navItems.filter(item => checkPermission(item.permission));
}, [navItems, user?.permissions]);

// Memoize components
const MemoizedNavItem = React.memo(NavItem);
```

### Code Splitting

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>,
});
```

### Prefetching

```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();

// Prefetch routes on hover
<Link 
  href="/dashboard/member"
  onMouseEnter={() => router.prefetch('/dashboard/member')}
>
  My Dashboard
</Link>
```

---

## Deployment Checklist

- [ ] All tests passing
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Permissions checked on all routes
- [ ] Mobile responsive
- [ ] Accessibility tested
- [ ] Performance optimized
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Database migrations run
- [ ] Environment variables set

---

## Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Tabler Icons:** https://tabler-icons.io
- **TanStack Query:** https://tanstack.com/query
- **Zustand:** https://github.com/pmndrs/zustand

---

## Contributing

### Code Style

- Use TypeScript for all new files
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Use Prettier for formatting
- Run ESLint before committing

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/new-feature

# Create pull request
```

### Commit Message Format

```
feat: add new navigation item
fix: resolve permission check issue
docs: update developer guide
style: format sidebar component
refactor: simplify route logic
test: add sidebar unit tests
chore: update dependencies
```

---

**Need Help?**  
Contact the development team or create an issue on GitHub.

**Document Version:** 1.0  
**Last Updated:** January 10, 2026
