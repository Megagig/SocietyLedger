# Settings Module Documentation

## Overview

The Settings module provides a comprehensive, permission-gated configuration system for SocietyLedger. It supports per-association settings with audit logging and prospective-only changes for financial settings.

## Architecture

### Backend Structure

```
apps/api/src/modules/settings/
├── settings.service.ts      # Core CRUD operations
├── settings.controller.ts   # HTTP handlers
├── settings.routes.ts       # Route definitions
├── settings.types.ts        # TypeScript interfaces
└── logo.service.ts          # Logo upload handling
```

### Frontend Structure

```
apps/web/src/app/dashboard/settings/
├── layout.tsx               # Settings layout with sidebar
├── page.tsx                 # Settings hub/overview
├── association/page.tsx     # Association profile
├── roles/page.tsx           # Roles & permissions
├── users/page.tsx           # User management
├── members-access/page.tsx  # Member signup rules
├── financial/page.tsx       # Financial configuration
├── payments/page.tsx        # Payment channels
├── notifications/page.tsx   # Notification preferences
├── integrations/page.tsx    # External services
├── data-privacy/page.tsx    # Data retention
└── audit-logs/page.tsx      # Activity history

apps/web/src/components/settings/
└── SettingsNav.tsx          # Sidebar navigation
```

## Settings Categories

| Category | API Path | Permission | Description |
|----------|----------|------------|-------------|
| association | `/settings/association` | settings.view/edit | Association profile |
| members_access | `/settings/members_access` | settings.edit | Member signup rules |
| financial | `/settings/financial` | settings.edit | Financial configuration |
| payments | `/settings/payments` | settings.billing | Payment channels |
| notifications | `/settings/notifications` | settings.edit | Notification preferences |
| integrations | `/settings/integrations` | settings.integrations | External services |
| data_privacy | `/settings/data_privacy` | settings.edit | Data retention |
| platform | `/admin/settings/platform` | SUPER_ADMIN | Platform-wide settings |

## API Endpoints

### Generic Settings API

```
GET    /api/settings/:category           # Get settings for category
PATCH  /api/settings/:category           # Update settings for category
```

### Association Profile

```
GET    /api/settings/association/profile  # Get association profile
PATCH  /api/settings/association/profile  # Update association profile
POST   /api/settings/association/logo     # Upload logo (multipart)
DELETE /api/settings/association/logo     # Delete logo
```

### Export

```
GET    /api/settings/export              # Export all settings as JSON
```

### Platform Settings (Super Admin)

```
GET    /api/admin/settings/platform      # Get platform settings & stats
PATCH  /api/admin/settings/platform      # Update platform settings
GET    /api/admin/settings/platform/stats # Get platform statistics
POST   /api/admin/associations/:id/override # Set association overrides
GET    /api/admin/associations/:id/override # Get association overrides
```

## Default Settings

### Association Settings

```typescript
{
  associationType: 'general',
  fiscalYearStart: 1,        // January
  timezone: 'Africa/Lagos',
  currency: 'NGN'
}
```

### Members Access Settings

```typescript
{
  selfSignupEnabled: false,
  defaultRole: 'member',
  requireApproval: true,
  requireEmailVerification: true,
  inviteExpiryHours: 72,
  allowMultipleRoles: false,
  memberIdAutoGenerate: true
}
```

### Financial Settings

```typescript
{
  defaultGracePeriodDays: 7,
  enableLateFees: false,
  lateFeeType: 'fixed',
  lateFeeAmount: 0,
  enablePartialPayments: true,
  requirePaymentApproval: false,
  fiscalYearStart: 1,
  currencyCode: 'NGN',
  currencySymbol: '₦',
  decimalPlaces: 2
}
```

### Payments Settings

```typescript
{
  enabledChannels: ['bank_transfer', 'cash'],
  defaultPaymentMethod: 'bank_transfer',
  enableManualPayments: true,
  manualPaymentApprovalRequired: true,
  enablePartialPayments: true,
  receiptAutoGenerate: true
}
```

### Notifications Settings

```typescript
{
  emailEnabled: true,
  smsEnabled: false,
  paymentReminderDays: [7, 3, 1],
  overdueReminderFrequency: 'weekly',
  senderName: 'SocietyLedger'
}
```

### Integrations Settings

```typescript
{
  paystackEnabled: false,
  nombaEnabled: false,
  smsProvider: 'none',
  apiAccessEnabled: false
}
```

### Data Privacy Settings

```typescript
{
  dataRetentionMonths: 84,    // 7 years
  softDeleteEnabled: true,
  anonymizeInactiveMembers: false,
  allowDataExport: true,
  gdprCompliant: false
}
```

## Permission Matrix

| Page | View Permission | Edit Permission |
|------|-----------------|-----------------|
| Association Profile | settings.view | settings.edit |
| Roles & Permissions | settings.view | settings.edit |
| User Management | user.view | user.edit |
| Members Access | settings.view | settings.edit |
| Financial Settings | settings.view | settings.edit |
| Payments & Billing | settings.billing | settings.billing |
| Notifications | settings.view | settings.edit |
| Integrations | settings.integrations | settings.integrations |
| Data & Privacy | settings.view | settings.edit |
| Audit Logs | audit.view | - |
| Platform Settings | SUPER_ADMIN | SUPER_ADMIN |

## Logo Upload

### Specifications

- **Max Size**: 2MB
- **Allowed Types**: JPEG, PNG, WebP
- **Storage**: `uploads/logos/`
- **URL Format**: `/uploads/logos/logo-{associationId}-{timestamp}.{ext}`

### Upload Flow

```typescript
// Frontend
const formData = new FormData();
formData.append('logo', file);

await api.post('/settings/association/logo', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Backend uses multer with memory storage
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});
```

## Audit Logging

All settings changes are automatically logged:

```typescript
await prisma.auditLog.create({
  data: {
    associationId,
    userId,
    action: 'SETTINGS_UPDATED',
    tableName: 'settings',
    oldValues: { category, changes: [...] },
    newValues: { category, changes: [...] }
  }
});
```

### Audit Log Fields

| Field | Description |
|-------|-------------|
| action | SETTINGS_UPDATED, LOGO_UPDATED, LOGO_DELETED |
| tableName | 'settings' or 'associations' |
| oldValues | Previous setting values |
| newValues | New setting values |
| userId | User who made the change |
| associationId | Association context |

## Frontend Patterns

### Settings Page Template

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Settings>({...defaults});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'category_name'],
    queryFn: async () => {
      const response = await api.get('/settings/category_name');
      return response.data.data;
    },
  });

  // Sync form with fetched data
  useEffect(() => {
    if (data) {
      setFormData(data);
      setHasChanges(false);
    }
  }, [data]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (settings) => {
      const response = await api.patch('/settings/category_name', settings);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Settings updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'category_name'] });
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update');
    },
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  // Render form...
}
```

### Toggle Switch Pattern

```tsx
<div className="flex items-center justify-between">
  <div>
    <label className="font-medium">Setting Label</label>
    <p className="text-sm text-gray-500">Description</p>
  </div>
  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      checked={formData.settingName}
      onChange={(e) => handleChange('settingName', e.target.checked)}
      className="sr-only peer"
    />
    <div className="w-11 h-6 bg-gray-200 peer-checked:bg-teal-600 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
  </label>
</div>
```

## Important Notes

### Prospective Changes

Financial settings changes only affect **new transactions**. Existing data is never modified retroactively.

```tsx
{/* Warning Banner */}
<div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
  <AlertTriangle className="w-5 h-5 text-amber-600" />
  <p>Changes will only affect <strong>new transactions</strong>.</p>
</div>
```

### Multi-tenancy

All settings are scoped to associations:

```typescript
// Settings are stored with associationId
await prisma.settings.upsert({
  where: { associationId_key: { associationId, key: fullKey } },
  update: { value: stringValue },
  create: { associationId, key: fullKey, value: stringValue }
});
```

### Platform Settings

Platform-level settings (SUPER_ADMIN only) use `associationId = null`:

```typescript
// Platform settings have no association
const settings = await prisma.settings.findMany({
  where: {
    associationId: null,
    key: { startsWith: 'platform.' }
  }
});
```

## Related Documentation

- [RBAC Documentation](../dynamic_rbac/README.md)
- [API Documentation](../api/README.md)
- [Database Schema](../architecture/database.md)
