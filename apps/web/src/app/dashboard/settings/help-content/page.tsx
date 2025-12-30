'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IconArrowLeft,
  IconArticle,
  IconQuestionMark,
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconEyeOff,
  IconStar,
  IconStarFilled,
  IconSearch,
} from '@tabler/icons-react';
import { Modal, TextInput, Textarea, Select, MultiSelect, Switch, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

interface HelpArticle {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string[];
  roleVisibility: string[];
  isPublished: boolean;
  isFeatured: boolean;
  viewCount: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  roleVisibility: string[];
  sortOrder: number;
  isActive: boolean;
  viewCount: number;
}

const ARTICLE_CATEGORIES = [
  { value: 'getting_started', label: 'Getting Started' },
  { value: 'members', label: 'Members' },
  { value: 'finance', label: 'Finance' },
  { value: 'payments', label: 'Payments' },
  { value: 'reports', label: 'Reports' },
  { value: 'governance', label: 'Governance' },
  { value: 'welfare', label: 'Welfare' },
  { value: 'settings', label: 'Settings' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
];

const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'account', label: 'Account' },
  { value: 'payments', label: 'Payments' },
  { value: 'members', label: 'Members' },
  { value: 'finance', label: 'Finance' },
  { value: 'technical', label: 'Technical' },
];

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'member', label: 'Member' },
];

export default function HelpContentManagementPage() {
  const [activeTab, setActiveTab] = useState<'articles' | 'faqs'>('articles');
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Article modal state
  const [articleModalOpened, { open: openArticleModal, close: closeArticleModal }] = useDisclosure(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: 'getting_started',
    tags: [] as string[],
    roleVisibility: ['admin', 'treasurer', 'member'],
    isPublished: true,
    isFeatured: false,
  });

  // FAQ modal state
  const [faqModalOpened, { open: openFaqModal, close: closeFaqModal }] = useDisclosure(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'general',
    roleVisibility: ['admin', 'treasurer', 'member'],
    sortOrder: 0,
    isActive: true,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    setLoading(true);
    try {
      const [articlesRes, faqsRes] = await Promise.all([
        api.get(API_ROUTES.HELP.ARTICLES + '?limit=100'),
        api.get(API_ROUTES.HELP.FAQS),
      ]);
      setArticles(articlesRes.data.data.articles || []);
      setFaqs(faqsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load content:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load help content',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  // Article functions
  function handleNewArticle() {
    setEditingArticle(null);
    setArticleForm({
      title: '',
      content: '',
      excerpt: '',
      category: 'getting_started',
      tags: [],
      roleVisibility: ['admin', 'treasurer', 'member'],
      isPublished: true,
      isFeatured: false,
    });
    openArticleModal();
  }

  function handleEditArticle(article: HelpArticle) {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt || '',
      category: article.category,
      tags: article.tags,
      roleVisibility: article.roleVisibility,
      isPublished: article.isPublished,
      isFeatured: article.isFeatured,
    });
    openArticleModal();
  }

  async function handleSaveArticle() {
    if (!articleForm.title || !articleForm.content) {
      notifications.show({
        title: 'Validation Error',
        message: 'Title and content are required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingArticle) {
        await api.put(`${API_ROUTES.HELP.ARTICLES}/${editingArticle.id}`, articleForm);
        notifications.show({
          title: 'Success',
          message: 'Article updated successfully',
          color: 'green',
        });
      } else {
        await api.post(API_ROUTES.HELP.ARTICLES, articleForm);
        notifications.show({
          title: 'Success',
          message: 'Article created successfully',
          color: 'green',
        });
      }
      closeArticleModal();
      loadContent();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save article',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteArticle(article: HelpArticle) {
    if (!confirm(`Are you sure you want to delete "${article.title}"?`)) return;

    try {
      await api.delete(`${API_ROUTES.HELP.ARTICLES}/${article.id}`);
      notifications.show({
        title: 'Success',
        message: 'Article deleted successfully',
        color: 'green',
      });
      loadContent();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete article',
        color: 'red',
      });
    }
  }

  async function handleToggleArticlePublished(article: HelpArticle) {
    try {
      await api.put(`${API_ROUTES.HELP.ARTICLES}/${article.id}`, {
        isPublished: !article.isPublished,
      });
      loadContent();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update article',
        color: 'red',
      });
    }
  }

  async function handleToggleArticleFeatured(article: HelpArticle) {
    try {
      await api.put(`${API_ROUTES.HELP.ARTICLES}/${article.id}`, {
        isFeatured: !article.isFeatured,
      });
      loadContent();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update article',
        color: 'red',
      });
    }
  }

  // FAQ functions
  function handleNewFaq() {
    setEditingFaq(null);
    setFaqForm({
      question: '',
      answer: '',
      category: 'general',
      roleVisibility: ['admin', 'treasurer', 'member'],
      sortOrder: faqs.length,
      isActive: true,
    });
    openFaqModal();
  }

  function handleEditFaq(faq: FAQItem) {
    setEditingFaq(faq);
    setFaqForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      roleVisibility: faq.roleVisibility,
      sortOrder: faq.sortOrder,
      isActive: faq.isActive,
    });
    openFaqModal();
  }

  async function handleSaveFaq() {
    if (!faqForm.question || !faqForm.answer) {
      notifications.show({
        title: 'Validation Error',
        message: 'Question and answer are required',
        color: 'red',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingFaq) {
        await api.put(`${API_ROUTES.HELP.FAQS}/${editingFaq.id}`, faqForm);
        notifications.show({
          title: 'Success',
          message: 'FAQ updated successfully',
          color: 'green',
        });
      } else {
        await api.post(API_ROUTES.HELP.FAQS, faqForm);
        notifications.show({
          title: 'Success',
          message: 'FAQ created successfully',
          color: 'green',
        });
      }
      closeFaqModal();
      loadContent();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save FAQ',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFaq(faq: FAQItem) {
    if (!confirm(`Are you sure you want to delete this FAQ?`)) return;

    try {
      await api.delete(`${API_ROUTES.HELP.FAQS}/${faq.id}`);
      notifications.show({
        title: 'Success',
        message: 'FAQ deleted successfully',
        color: 'green',
      });
      loadContent();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete FAQ',
        color: 'red',
      });
    }
  }

  async function handleToggleFaqActive(faq: FAQItem) {
    try {
      await api.put(`${API_ROUTES.HELP.FAQS}/${faq.id}`, {
        isActive: !faq.isActive,
      });
      loadContent();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update FAQ',
        color: 'red',
      });
    }
  }

  // Filter content based on search
  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaqs = faqs.filter(f =>
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 mb-4"
        >
          <IconArrowLeft size={18} />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help Content Management</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage help articles and FAQs for your members
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('articles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'articles'
              ? 'bg-teal-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <IconArticle size={18} />
          Articles ({articles.length})
        </button>
        <button
          onClick={() => setActiveTab('faqs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'faqs'
              ? 'bg-teal-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <IconQuestionMark size={18} />
          FAQs ({faqs.length})
        </button>
      </div>

      {/* Search and Add */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <button
          onClick={activeTab === 'articles' ? handleNewArticle : handleNewFaq}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
        >
          <IconPlus size={18} />
          Add {activeTab === 'articles' ? 'Article' : 'FAQ'}
        </button>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : activeTab === 'articles' ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredArticles.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredArticles.map((article) => (
                <div key={article.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{article.title}</h3>
                      {article.isFeatured && (
                        <IconStarFilled size={16} className="text-yellow-500 flex-shrink-0" />
                      )}
                      {!article.isPublished && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Draft</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {article.category.replace(/_/g, ' ')}
                      </span>
                      <span>{article.viewCount} views</span>
                      <span>{article.helpfulCount} helpful</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleArticleFeatured(article)}
                      className={`p-2 rounded-lg ${article.isFeatured ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                      title={article.isFeatured ? 'Remove from featured' : 'Mark as featured'}
                    >
                      {article.isFeatured ? <IconStarFilled size={18} /> : <IconStar size={18} />}
                    </button>
                    <button
                      onClick={() => handleToggleArticlePublished(article)}
                      className={`p-2 rounded-lg ${article.isPublished ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}
                      title={article.isPublished ? 'Unpublish' : 'Publish'}
                    >
                      {article.isPublished ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                    </button>
                    <button
                      onClick={() => handleEditArticle(article)}
                      className="p-2 text-gray-400 hover:text-teal-500 rounded-lg"
                      title="Edit"
                    >
                      <IconEdit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(article)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                      title="Delete"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <IconArticle size={48} className="mx-auto mb-4 opacity-50" />
              <p>No articles found</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredFaqs.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{faq.question}</h3>
                      {!faq.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {faq.category}
                      </span>
                      <span>{faq.viewCount} views</span>
                      <span>Order: {faq.sortOrder}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleFaqActive(faq)}
                      className={`p-2 rounded-lg ${faq.isActive ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}
                      title={faq.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {faq.isActive ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                    </button>
                    <button
                      onClick={() => handleEditFaq(faq)}
                      className="p-2 text-gray-400 hover:text-teal-500 rounded-lg"
                      title="Edit"
                    >
                      <IconEdit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteFaq(faq)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                      title="Delete"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <IconQuestionMark size={48} className="mx-auto mb-4 opacity-50" />
              <p>No FAQs found</p>
            </div>
          )}
        </div>
      )}

      {/* Article Modal */}
      <Modal
        opened={articleModalOpened}
        onClose={closeArticleModal}
        title={editingArticle ? 'Edit Article' : 'New Article'}
        size="xl"
      >
        <div className="space-y-4">
          <TextInput
            label="Title"
            placeholder="Article title"
            value={articleForm.title}
            onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
            required
          />
          <Textarea
            label="Content"
            placeholder="Article content (supports markdown)"
            value={articleForm.content}
            onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
            minRows={10}
            required
          />
          <TextInput
            label="Excerpt"
            placeholder="Short description"
            value={articleForm.excerpt}
            onChange={(e) => setArticleForm({ ...articleForm, excerpt: e.target.value })}
          />
          <Select
            label="Category"
            data={ARTICLE_CATEGORIES}
            value={articleForm.category}
            onChange={(value) => setArticleForm({ ...articleForm, category: value || 'getting_started' })}
          />
          <TextInput
            label="Tags"
            placeholder="Comma-separated tags"
            value={articleForm.tags.join(', ')}
            onChange={(e) => setArticleForm({ 
              ...articleForm, 
              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
            })}
          />
          <MultiSelect
            label="Visible to Roles"
            data={ROLES}
            value={articleForm.roleVisibility}
            onChange={(value) => setArticleForm({ ...articleForm, roleVisibility: value })}
          />
          <div className="flex gap-4">
            <Switch
              label="Published"
              checked={articleForm.isPublished}
              onChange={(e) => setArticleForm({ ...articleForm, isPublished: e.currentTarget.checked })}
            />
            <Switch
              label="Featured"
              checked={articleForm.isFeatured}
              onChange={(e) => setArticleForm({ ...articleForm, isFeatured: e.currentTarget.checked })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeArticleModal}>Cancel</Button>
            <Button onClick={handleSaveArticle} loading={saving}>
              {editingArticle ? 'Update' : 'Create'} Article
            </Button>
          </div>
        </div>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        opened={faqModalOpened}
        onClose={closeFaqModal}
        title={editingFaq ? 'Edit FAQ' : 'New FAQ'}
        size="lg"
      >
        <div className="space-y-4">
          <TextInput
            label="Question"
            placeholder="FAQ question"
            value={faqForm.question}
            onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
            required
          />
          <Textarea
            label="Answer"
            placeholder="FAQ answer"
            value={faqForm.answer}
            onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
            minRows={5}
            required
          />
          <Select
            label="Category"
            data={FAQ_CATEGORIES}
            value={faqForm.category}
            onChange={(value) => setFaqForm({ ...faqForm, category: value || 'general' })}
          />
          <MultiSelect
            label="Visible to Roles"
            data={ROLES}
            value={faqForm.roleVisibility}
            onChange={(value) => setFaqForm({ ...faqForm, roleVisibility: value })}
          />
          <TextInput
            label="Sort Order"
            type="number"
            value={faqForm.sortOrder.toString()}
            onChange={(e) => setFaqForm({ ...faqForm, sortOrder: parseInt(e.target.value) || 0 })}
          />
          <Switch
            label="Active"
            checked={faqForm.isActive}
            onChange={(e) => setFaqForm({ ...faqForm, isActive: e.currentTarget.checked })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={closeFaqModal}>Cancel</Button>
            <Button onClick={handleSaveFaq} loading={saving}>
              {editingFaq ? 'Update' : 'Create'} FAQ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
