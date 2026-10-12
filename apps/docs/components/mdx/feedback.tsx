'use client';
import { trackEvent } from '@/lib/analytics';
import { useState } from 'react';

/**
 * "Was this page helpful?" + Yes/No, optional comment on No
 * (`ui-rules.md §11.5`, `architecture.md §14.8`). Dispatches through
 * `lib/analytics.ts` (stubbed until D1.5 wires up GA4) — no backend
 * endpoint; the comment text itself is never sent, only its length.
 */
export function Feedback({ slug }: { slug: string }) {
  const [state, setState] = useState<'idle' | 'thanks' | 'asking'>('idle');
  const [comment, setComment] = useState('');

  function choose(helpful: boolean) {
    if (!helpful) {
      setState('asking');
      return;
    }
    trackEvent('docs_feedback', { slug, helpful: true, comment_length: 0 });
    setState('thanks');
  }

  function submitComment() {
    trackEvent('docs_feedback', { slug, helpful: false, comment_length: comment.length });
    setState('thanks');
  }

  if (state === 'thanks') {
    return <p className="docs-text-small text-fd-muted-foreground">Thanks — this helps us improve the manual.</p>;
  }

  return (
    <div className="docs-text-small flex flex-col gap-2 border-t border-fd-border pt-4">
      <div className="flex items-center gap-3">
        <span>Was this page helpful?</span>
        <button type="button" className="font-medium text-fd-primary hover:underline" onClick={() => choose(true)}>
          Yes
        </button>
        <button type="button" className="font-medium text-fd-primary hover:underline" onClick={() => choose(false)}>
          No
        </button>
      </div>
      {state === 'asking' && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${slug}-feedback-comment`} className="sr-only">
            What were you looking for?
          </label>
          <textarea
            id={`${slug}-feedback-comment`}
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 280))}
            maxLength={280}
            placeholder="What were you looking for?"
            className="min-h-16 rounded-(--radius-md) border border-fd-border bg-fd-background p-2 text-fd-foreground"
          />
          <button
            type="button"
            className="self-start font-medium text-fd-primary hover:underline"
            onClick={submitComment}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
