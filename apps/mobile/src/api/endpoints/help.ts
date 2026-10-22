import { client } from '../client';
import { unwrap } from '../envelope';
import type {
  ArticleListDTO,
  ArticleVoteResultDTO,
  FaqCategoryGroupDTO,
  HelpArticleDTO,
  HelpCenterDTO,
} from '@/types/api/help';

/** `/help/*` — open to every signed-in user; content is filtered server-side to the caller's role and association. */
export const helpApi = {
  /** GET /help — featured articles, top FAQs and category counts. */
  async getHelpCenter(): Promise<HelpCenterDTO> {
    return unwrap<HelpCenterDTO>(client.get('/help'));
  },

  /** GET /help/articles/search?q= — at least 2 characters. Response is `{ articles, query }`. */
  async searchArticles(query: string, limit = 10): Promise<HelpArticleDTO[]> {
    const { articles } = await unwrap<{ articles: HelpArticleDTO[]; query: string }>(client.get('/help/articles/search', { params: { q: query, limit } }));
    return articles;
  },

  /** GET /help/articles?category= — one category's published articles. */
  async listArticles(params: { category?: string; limit?: number; offset?: number } = {}): Promise<ArticleListDTO> {
    return unwrap<ArticleListDTO>(client.get('/help/articles', { params: { limit: 50, ...params } }));
  },

  /** GET /help/articles/:slug — 404 for an article the caller's role can't see. Counts a view. */
  async getArticle(slug: string): Promise<HelpArticleDTO> {
    return unwrap<HelpArticleDTO>(client.get(`/help/articles/${encodeURIComponent(slug)}`));
  },

  /** POST /help/articles/:id/helpful — one vote per call; the server doesn't dedupe, so the screen blocks a second tap. */
  async voteArticle(id: number, helpful: boolean): Promise<ArticleVoteResultDTO> {
    return unwrap<ArticleVoteResultDTO>(client.post(`/help/articles/${id}/helpful`, { helpful }));
  },

  /** GET /help/faqs/by-category — `[{ category, items }]`. */
  async getFaqsByCategory(): Promise<FaqCategoryGroupDTO[]> {
    return unwrap<FaqCategoryGroupDTO[]>(client.get('/help/faqs/by-category'));
  },
};
