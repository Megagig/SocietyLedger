'use client';
import { Play } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

/**
 * Lazy, privacy-enhanced video embed (`build-plan.md` D1.4): a click-to-load
 * facade, so the YouTube iframe (and its cookies/JS) never loads until the
 * reader opts in; uses `youtube-nocookie.com` even after that.
 */
export function VideoEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div className="my-6 aspect-video overflow-hidden rounded-(--radius-md) border border-fd-border">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="group relative my-6 flex aspect-video w-full items-center justify-center overflow-hidden rounded-(--radius-md) border border-fd-border bg-fd-muted"
    >
      <Image
        src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
        alt=""
        fill
        className="object-cover"
      />
      <span className="relative z-10 flex size-14 items-center justify-center rounded-full bg-fd-primary text-fd-primary-foreground transition-transform group-hover:scale-110">
        <Play aria-hidden className="size-6" fill="currentColor" />
      </span>
      <span className="sr-only">Play video: {title}</span>
    </button>
  );
}
