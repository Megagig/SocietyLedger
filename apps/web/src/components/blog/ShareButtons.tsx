'use client';

import { Group, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconBrandTwitter,
  IconBrandFacebook,
  IconBrandLinkedin,
  IconLink,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import { useState } from 'react';

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleShare = (platform: string) => {
    const shareUrl = shareUrls[platform as keyof typeof shareUrls];
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  return (
    <Group gap="xs">
      <Tooltip label="Share on Twitter">
        <ActionIcon
          variant="light"
          color="blue"
          size="lg"
          onClick={() => handleShare('twitter')}
        >
          <IconBrandTwitter size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Share on Facebook">
        <ActionIcon
          variant="light"
          color="blue"
          size="lg"
          onClick={() => handleShare('facebook')}
        >
          <IconBrandFacebook size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Share on LinkedIn">
        <ActionIcon
          variant="light"
          color="blue"
          size="lg"
          onClick={() => handleShare('linkedin')}
        >
          <IconBrandLinkedin size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={copied ? 'Copied!' : 'Copy link'}>
        <ActionIcon
          variant="light"
          color="gray"
          size="lg"
          onClick={handleCopyLink}
        >
          {copied ? <IconCheck size={20} /> : <IconCopy size={20} />}
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
