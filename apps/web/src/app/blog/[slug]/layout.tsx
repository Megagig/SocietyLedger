import { Metadata } from 'next';
import { generateBlogPostMetadata } from './metadata';

interface BlogPostLayoutProps {
  params: { slug: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: BlogPostLayoutProps): Promise<Metadata> {
  const { metadata } = await generateBlogPostMetadata(params.slug);
  return metadata;
}

export default function BlogPostLayout({ children }: BlogPostLayoutProps) {
  return <>{children}</>;
}
