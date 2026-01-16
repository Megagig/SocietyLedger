import { Metadata } from 'next';
import { generateDocPageMetadata } from './metadata';

interface DocPageLayoutProps {
  params: { slug: string };
  children: React.ReactNode;
}

export async function generateMetadata({ params }: DocPageLayoutProps): Promise<Metadata> {
  const { metadata } = await generateDocPageMetadata(params.slug);
  return metadata;
}

export default function DocPageLayout({ children }: DocPageLayoutProps) {
  return <>{children}</>;
}
