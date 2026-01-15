import { DocPage, DocSection, DocFeedback, DocStatus, ContentScope } from '@prisma/client';

export type DocPageWithRelations = DocPage & {
  author: {
    id: number;
    email: string;
  };
  section?: DocSection | null;
  parent?: DocPage | null;
  children?: DocPage[];
  feedback?: DocFeedback[];
  _count?: {
    feedback?: number;
  };
};

export type DocSectionWithPages = DocSection & {
  pages: DocPage[];
  _count?: {
    pages: number;
  };
};

export type DocFeedbackWithUser = DocFeedback & {
  user?: {
    id: number;
    email: string;
  } | null;
};

export interface CreatePageDto {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  order?: number;
  scope?: ContentScope;
  parentId?: number;
  sectionId?: number;
  metaTitle?: string;
  metaDescription?: string;
  version?: string;
}

export interface UpdatePageDto {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  order?: number;
  parentId?: number | null;
  sectionId?: number | null;
  metaTitle?: string;
  metaDescription?: string;
  version?: string;
  status?: DocStatus;
  publishedAt?: Date | null;
}

export interface CreateSectionDto {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface UpdateSectionDto {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface CreateFeedbackDto {
  isHelpful: boolean;
  comment?: string;
  email?: string;
}

export interface DocSearchParams {
  query?: string;
  sectionId?: number;
  status?: DocStatus;
  page?: number;
  limit?: number;
}

export interface DocPageListResponse {
  pages: DocPageWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
