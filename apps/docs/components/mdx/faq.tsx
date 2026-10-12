import { Accordions, Accordion } from 'fumadocs-ui/components/accordion';
import type { ReactNode } from 'react';

/**
 * Accordion; question in 600 weight; each item has an anchor link
 * (`ui-rules.md §11.5`). `<Faq>` wraps Fumadocs' `Accordions`; each
 * question is a `<FaqItem question="…">`, which sets an `id` from the
 * question text so it's deep-linkable. `code-standards.md §17.3`'s FAQ
 * template (plain H2 per question) still applies to FAQ *pages* — this
 * component is for Q&A blocks inside other pages (e.g. a section
 * overview) that want the collapsed, space-saving treatment.
 */
export function Faq({ children }: { children: ReactNode }) {
  return <Accordions>{children}</Accordions>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <Accordion id={slugify(question)} title={question}>
      {children}
    </Accordion>
  );
}
