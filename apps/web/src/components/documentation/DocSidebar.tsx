'use client';

import { useState, useEffect } from 'react';
import { Box, Stack, Text, UnstyledButton, Collapse, Group, ScrollArea, Badge } from '@mantine/core';
import { IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { API_ROUTES } from '@/utils/constants';

interface DocSection {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  order: number;
  pages?: DocPage[];
}

interface DocPage {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  order: number;
  sectionId?: number | null;
}

interface DocSidebarProps {
  currentSlug?: string;
}

export function DocSidebar({ currentSlug }: DocSidebarProps) {
  const pathname = usePathname();
  const [sections, setSections] = useState<DocSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    // Auto-expand section containing current page
    if (currentSlug && sections.length > 0) {
      const sectionWithCurrentPage = sections.find(section =>
        section.pages?.some(page => page.slug === currentSlug)
      );
      if (sectionWithCurrentPage) {
        setExpandedSections(prev => new Set([...prev, sectionWithCurrentPage.id]));
      }
    }
  }, [currentSlug, sections]);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ROUTES.DOCUMENTATION.SECTIONS);
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }

      const data = await response.json();
      const sectionsData = data.data?.sections || [];

      // Fetch pages for each section
      const sectionsWithPages = await Promise.all(
        sectionsData.map(async (section: DocSection) => {
          try {
            const pagesResponse = await fetch(
              `${API_ROUTES.DOCUMENTATION.PAGES}?sectionId=${section.id}`
            );
            if (pagesResponse.ok) {
              const pagesData = await pagesResponse.json();
              return {
                ...section,
                pages: pagesData.data?.pages || [],
              };
            }
            return section;
          } catch (err) {
            console.error('Error fetching pages for section:', section.id, err);
            return section;
          }
        })
      );

      setSections(sectionsWithPages);
    } catch (err) {
      console.error('Error fetching sections:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: number) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Box p="md">
        <Text c="dimmed" size="sm">Loading documentation...</Text>
      </Box>
    );
  }

  return (
    <ScrollArea.Autosize mah="calc(100vh - 200px)">
      <Stack gap="xs" p="md">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const hasPages = section.pages && section.pages.length > 0;
          const isCurrentSection = section.pages?.some(page => page.slug === currentSlug);

          return (
            <Box key={section.id}>
              <UnstyledButton
                w="100%"
                p="xs"
                onClick={() => hasPages && toggleSection(section.id)}
                className={`sidebar-section ${isCurrentSection ? 'active' : ''}`}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap">
                    {section.icon && (
                      <Text size="lg" c="teal">
                        {getIconEmoji(section.icon)}
                      </Text>
                    )}
                    <Text
                      size="sm"
                      fw={isCurrentSection ? 600 : 400}
                      c={isCurrentSection ? 'teal' : 'dimmed'}
                    >
                      {section.name}
                    </Text>
                  </Group>
                  {hasPages && (
                    <Box>
                      {isExpanded ? (
                        <IconChevronDown size={16} />
                      ) : (
                        <IconChevronRight size={16} />
                      )}
                    </Box>
                  )}
                </Group>
              </UnstyledButton>

              {hasPages && (
                <Collapse in={isExpanded}>
                  <Stack gap="xs" pl="md" pt="xs">
                    {section.pages &&
                      section.pages
                        .sort((a, b) => a.order - b.order)
                        .map((page) => {
                          const isActive = page.slug === currentSlug;
                          return (
                            <UnstyledButton
                              key={page.id}
                              component={Link}
                              href={`/documentation/${page.slug}`}
                              w="100%"
                              p="xs"
                              className={`sidebar-page ${isActive ? 'active' : ''}`}
                            >
                              <Text
                                size="sm"
                                fw={isActive ? 600 : 400}
                                c={isActive ? 'teal' : 'dimmed'}
                              >
                                {page.title}
                              </Text>
                            </UnstyledButton>
                          );
                        })}
                  </Stack>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Stack>

      <style jsx global>{`
        .sidebar-section {
          border-radius: 0.375rem;
          transition: all 0.2s ease;
        }
        .sidebar-section:hover {
          background-color: #f0fdfa;
        }
        .dark .sidebar-section:hover {
          background-color: #1e293b;
        }
        .sidebar-section.active {
          background-color: #f0fdfa;
        }
        .dark .sidebar-section.active {
          background-color: #1e293b;
        }
        .sidebar-page {
          border-radius: 0.375rem;
          transition: all 0.2s ease;
        }
        .sidebar-page:hover {
          background-color: #f0fdfa;
        }
        .dark .sidebar-page:hover {
          background-color: #1e293b;
        }
        .sidebar-page.active {
          background-color: #ccfbf1;
          border-left: 3px solid #0d9488;
        }
        .dark .sidebar-page.active {
          background-color: #0f766e;
          border-left: 3px solid #2dd4bf;
        }
      `}</style>
    </ScrollArea.Autosize>
  );
}

function getIconEmoji(iconName: string): string {
  const iconMap: Record<string, string> = {
    rocket: '🚀',
    book: '📚',
    users: '👥',
    chart: '📊',
    settings: '⚙️',
    help: '❓',
    shield: '🛡️',
    star: '⭐',
    zap: '⚡',
    code: '💻',
    database: '🗄️',
    cloud: '☁️',
    lock: '🔒',
    bell: '🔔',
    mail: '📧',
    phone: '📱',
    calendar: '📅',
    file: '📄',
    folder: '📁',
    search: '🔍',
    filter: '🎯',
    check: '✅',
    x: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    bulb: '💡',
    heart: '❤️',
    thumb: '👍',
  };
  return iconMap[iconName] || '📄';
}
