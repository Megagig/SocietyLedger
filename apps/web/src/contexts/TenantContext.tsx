"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  logo?: string | null;
  primaryColor?: string | null;
};

type TenantContextValue = {
  tenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Extract subdomain from window.location.hostname
      const extractSubdomain = (hostname: string): string | null => {
        const host = hostname.toLowerCase();
        
        // Handle localhost subdomains (e.g., demo.localhost)
        if (host.endsWith('.localhost')) {
          const parts = host.split('.');
          if (parts.length >= 2) {
            const sub = parts[0];
            return sub !== 'www' ? sub : null;
          }
        }
        
        // Handle regular domains
        if (host === 'localhost' || host === '127.0.0.1') return null;
        const parts = host.split('.');
        if (parts.length < 3) return null;
        const [sub] = parts;
        if (sub === 'www') return null;
        return sub;
      };

      const subdomain = extractSubdomain(window.location.hostname);
      
      if (!subdomain) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // Check if subdomain/association exists
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/associations/check-subdomain?subdomain=${subdomain}`, { 
        credentials: 'include' 
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to resolve tenant');
      }
      setTenant(data.data);
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve tenant');
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, isLoading, error, refresh }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
