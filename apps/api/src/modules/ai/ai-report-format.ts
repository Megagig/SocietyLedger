/**
 * How an AI report is asked for and read back: the instructions the model gets for each kind of report, the layout it must answer in,
 * and the reader that turns its answer into a title, sections, highlights and recommendations. Pure, so it can be tested on its own.
 */

import type { AIReportResponse } from './ai.types';

export type ReportType = 'monthly_summary' | 'quarterly_review' | 'annual_report' | 'treasurer_handover';

/** The model's instructions for one kind of report. */
export function reportSystemPrompt(reportType: string): string {
  const basePrompt = `You are a professional financial report writer for SocietyLedger, a platform for African association management.

CRITICAL RULES:
1. You ONLY summarize and explain data that is provided to you
2. You NEVER perform calculations - all numbers must come from the provided data
3. You NEVER make up or infer data that wasn't provided
4. Members appear as "Member 1", "Member 2" and so on. Always refer to them exactly like that, never invent names
5. Use Nigerian Naira (₦) for all currency amounts
6. Be professional, clear, and concise

Your reports should be:
- Well-structured with clear sections
- Easy to understand for non-financial readers
- Actionable with clear insights`;

  const typeSpecific: Record<string, string> = {
    monthly_summary: `\n\nYou are generating a MONTHLY FINANCIAL SUMMARY. Focus on:
- Key financial highlights
- Money received against what was spent
- Collection performance
- Notable trends`,
    quarterly_review: `\n\nYou are generating a QUARTERLY REVIEW. Focus on:
- How the quarter went
- Major achievements and challenges
- Strategic recommendations
- Member engagement`,
    annual_report: `\n\nYou are generating an ANNUAL REPORT. Focus on:
- Year-in-review highlights
- Financial health assessment
- Membership
- Future outlook and recommendations`,
    treasurer_handover: `\n\nYou are generating a TREASURER HANDOVER REPORT. Focus on:
- Current financial position
- Outstanding obligations
- Pending matters requiring attention
- Recommendations for the incoming treasurer`,
  };

  return basePrompt + (typeSpecific[reportType] ?? '');
}

/** The request for one report: the figures, and the layout the answer must follow. */
export function reportUserPrompt(reportType: string, figures: string, associationName: string, includeRecommendations: boolean): string {
  return `
Generate a ${reportType.replace(/_/g, ' ')} for ${associationName}.

${figures}

Please generate a structured report with:
1. TITLE (appropriate for the report type)
2. EXECUTIVE SUMMARY (2-3 sentences)
3. SECTIONS (3-5 sections with headings and content)
4. KEY HIGHLIGHTS (3-5 bullet points)
${includeRecommendations ? '5. RECOMMENDATIONS (3-5 actionable items)' : ''}

Format your response as:
TITLE: [title]
SUMMARY: [summary]
SECTION: [heading]
[content]
SECTION: [heading]
[content]
HIGHLIGHTS:
- [highlight 1]
- [highlight 2]
${includeRecommendations ? 'RECOMMENDATIONS:\n- [recommendation 1]\n- [recommendation 2]' : ''}
`.trim();
}

/** Reads the model's answer in that layout. Anything it could not read is kept as a single "Overview" section rather than lost. */
export function parseReport(content: string, reportType: string): Omit<AIReportResponse, 'tokensUsed'> {
  const lines = content.split('\n');
  let title = `${reportType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Report`;
  let summary = '';
  const sections: { heading: string; content: string }[] = [];
  const highlights: string[] = [];
  const recommendations: string[] = [];

  let currentSection: { heading: string; content: string } | null = null;
  let mode: 'none' | 'section' | 'highlights' | 'recommendations' = 'none';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('TITLE:')) {
      title = trimmed.replace('TITLE:', '').trim();
    } else if (trimmed.startsWith('SUMMARY:')) {
      summary = trimmed.replace('SUMMARY:', '').trim();
    } else if (trimmed.startsWith('SECTION:')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: trimmed.replace('SECTION:', '').trim(), content: '' };
      mode = 'section';
    } else if (trimmed === 'HIGHLIGHTS:') {
      if (currentSection) {
        sections.push(currentSection);
        currentSection = null;
      }
      mode = 'highlights';
    } else if (trimmed === 'RECOMMENDATIONS:') {
      mode = 'recommendations';
    } else if (trimmed.startsWith('- ')) {
      const item = trimmed.substring(2).trim();
      if (mode === 'highlights') highlights.push(item);
      else if (mode === 'recommendations') recommendations.push(item);
    } else if (mode === 'section' && currentSection && trimmed) {
      currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
    }
  }
  if (currentSection) sections.push(currentSection);

  return {
    title,
    summary: summary || 'Financial report generated successfully.',
    sections: sections.length > 0 ? sections : [{ heading: 'Overview', content }],
    highlights: highlights.length > 0 ? highlights : ['Report generated successfully'],
    recommendations: recommendations.length > 0 ? recommendations : undefined,
    generatedAt: new Date(),
  };
}
