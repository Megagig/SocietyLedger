'use client';

import { useEffect, useState } from 'react';
import { Container, Button, Stack, Title, Text, LoadingOverlay, Alert, Group, Card, Badge, Anchor } from '@mantine/core';
import { IconBook, IconAlertCircle, IconArrowRight, IconRocket, IconUsers, IconChartBar, IconSettings } from '@tabler/icons-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DocSearch } from '@/components/documentation/DocSearch';
import { API_ROUTES } from '@/utils/constants';
import Footer from '@/components/layout/Footer';
import Header from '@/components/layout/Header';

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

export default function DocumentationPage() {
  const [sections, setSections] = useState<DocSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ROUTES.DOCUMENTATION.SECTIONS);

      if (!response.ok) {
        throw new Error('Failed to fetch documentation');
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
      console.error('Error fetching documentation:', err);
      setError('Failed to load documentation. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getIconComponent = (iconName?: string | null) => {
    const iconMap: Record<string, any> = {
      rocket: IconRocket,
      book: IconBook,
      users: IconUsers,
      chart: IconChartBar,
      settings: IconSettings,
    };
    const IconComponent = iconName ? iconMap[iconName] : IconBook;
    return IconComponent ? <IconComponent size={32} /> : <IconBook size={32} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <LoadingOverlay visible={loading} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <Container size="lg" py="xl">
          <Alert icon={<IconAlertCircle size={20} />} color="red" title="Error">
            {error}
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-green-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Header />

      <section className="pt-32 pb-12 px-4">
        <Container size="lg">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 mb-6">
              <IconBook className="text-teal-500" size={40} />
            </div>
            <Title order={1} className="mb-6">
              <span className="bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent">
                Documentation
              </span>
            </Title>
            <Text size="xl" c="dimmed" maw={800} mx="auto">
              Everything you need to know about using SocietyLedger. From setup to advanced features.
            </Text>
          </div>
        </Container>
      </section>

      <section className="pb-20 px-4">
        <Container size="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {sections.map((section) => (
              <Card
                key={section.id}
                p="xl"
                radius="md"
                className="glass-strong hover:shadow-xl transition-all"
              >
                <Stack gap="md">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-green-500/20 border border-teal-500/30 flex items-center justify-center text-teal-500">
                    {getIconComponent(section.icon)}
                  </div>
                  <div>
                    <Title order={3} mb="xs">{section.name}</Title>
                    {section.description && (
                      <Text c="dimmed" mb="md">{section.description}</Text>
                    )}
                  </div>
                  {section.pages && section.pages.length > 0 && (
                    <Stack gap="xs">
                      {section.pages
                        .sort((a, b) => a.order - b.order)
                        .slice(0, 4)
                        .map((page) => (
                          <Anchor
                            key={page.id}
                            component={Link}
                            href={`/documentation/${page.slug}`}
                            size="sm"
                            c="dimmed"
                          >
                            {page.title}
                          </Anchor>
                        ))}
                      {section.pages.length > 4 && (
                        <Text size="sm" c="teal" fw={500}>
                          +{section.pages.length - 4} more pages
                        </Text>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Card>
            ))}
          </div>

          {sections.length === 0 && (
            <Alert icon={<IconAlertCircle size={20} />} color="blue" title="No Documentation Yet">
              Documentation is being created. Check back soon for helpful guides and tutorials.
            </Alert>
          )}
        </Container>
      </section>

      <Footer />
    </div>
  );
}
