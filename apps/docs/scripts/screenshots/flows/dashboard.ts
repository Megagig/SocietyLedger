import type { Page } from '@playwright/test';
import type { Role } from '../constants';

export interface Shot {
  name: string;
  role: Role;
  url: string;
  prepare?: (page: Page) => Promise<void>;
  clip?: { x: number; y: number; width: number; height: number };
  /** The whole scrollable page, not just the first screen. */
  fullPage?: boolean;
  /** Freeze the browser clock at this instant instead of the default. */
  instant?: number;
}

export interface Flow {
  section: string;
  shots: Shot[];
}

/**
 * The one sample flow D1.6 asks for (`build-plan.md`): the association
 * dashboard, which `reports/association-dashboard.mdx` (`sitemap-data.ts`)
 * documents — hence `section: 'reports'`, matching the DoD's own example
 * invocation (`--section=reports`).
 */
export const flow: Flow = {
  section: 'reports',
  shots: [
    {
      name: 'association-dashboard',
      role: 'admin',
      url: '/dashboard',
    },
  ],
};
