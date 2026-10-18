'use client';

interface EnvBadgeProps {
  env?: string;
}

export function EnvBadge({ env }: EnvBadgeProps) {
  const e = env ?? process.env.NEXT_PUBLIC_ENV ?? 'production';
  if (e === 'production') {
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          backgroundColor: 'var(--admin-env-prod-bg)',
          color: 'var(--admin-env-prod-fg)',
        }}
      >
        PROD
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        backgroundColor: 'var(--admin-env-staging-bg)',
        color: 'var(--admin-env-staging-fg)',
      }}
    >
      STAGING
    </span>
  );
}
