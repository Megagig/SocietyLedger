import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import type { MDXComponents } from 'mdx/types';
import { AppliesTo } from './mdx/applies-to';
import { Callout } from './mdx/callout';
import { CardGrid, Card } from './mdx/card-grid';
import { Diagram } from './mdx/diagram';
import { Faq, FaqItem } from './mdx/faq';
import { Glossary } from './mdx/glossary';
import { MenuPath } from './mdx/menu-path';
import { PermissionNote } from './mdx/permission-note';
import { PlanNote } from './mdx/plan-note';
import { PlatformBadge } from './mdx/platform-badge';
import { PlatformTab, PlatformTabs } from './mdx/platform-tabs';
import { RoleTab, RoleTabs } from './mdx/role-tabs';
import { Screenshot } from './mdx/screenshot';
import { StatusChip } from './mdx/status-chip';
import { UiLabel } from './mdx/ui-label';
import { VideoEmbed } from './mdx/video-embed';

const societyLedgerMdxComponents = {
  AppliesTo,
  Callout,
  CardGrid,
  Card,
  Diagram,
  Faq,
  FaqItem,
  Glossary,
  MenuPath,
  PermissionNote,
  PlanNote,
  PlatformBadge,
  PlatformTabs,
  PlatformTab,
  RoleTabs,
  RoleTab,
  Screenshot,
  StatusChip,
  Steps,
  Step,
  UiLabel,
  VideoEmbed,
} satisfies MDXComponents;

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    ...societyLedgerMdxComponents,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
