import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://societyledger.com.ng',
      lastModified: new Date(),
    },
    {
      url: 'https://societyledger.com.ng/pricing',
      lastModified: new Date(),
    },
    {
      url: 'https://societyledger.com.ng/features',
      lastModified: new Date(),
    },
  ];
}
