/** Help centre — `/api/help/*` (any signed-in user; no module gate). Verified 2026-10-22 against help.controller.ts / help.types.ts. */
import type { IsoDateString } from './common';

export type HelpArticleDTO = {
  id: number;
  slug: string;
  title: string;
  /** Plain text with light formatting (`#`/`##`/`###` headings, `-`/`*` bullets, `1.` numbered lines) — see `parseArticleContent`. */
  content: string;
  excerpt: string | null;
  category: string;
  tags: string[];
  isFeatured: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  updatedAt: IsoDateString;
};

export type FaqDTO = {
  id: number;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
};

export type HelpCategoryDTO = { name: string; count: number };

/** GET /help — the Help Center home. `quickActions` are web links and are not used on mobile. */
export type HelpCenterDTO = {
  featuredArticles: HelpArticleDTO[];
  topFAQs: FaqDTO[];
  categories: HelpCategoryDTO[];
};

export type ArticleListDTO = { articles: HelpArticleDTO[]; total: number; hasMore: boolean };

export type FaqCategoryGroupDTO = { category: string; items: FaqDTO[] };

export type ArticleVoteResultDTO = { helpfulCount: number; notHelpfulCount: number };
