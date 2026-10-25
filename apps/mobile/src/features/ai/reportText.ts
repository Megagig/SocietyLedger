import type { AiReportDTO } from '@/types/api/ai';

/** The report as plain text to share (WhatsApp, email). Reports are not saved on the server; this is how an officer keeps one. */
export function reportShareText(report: AiReportDTO, associationName?: string): string {
  const lines: string[] = [report.title, associationName ? `${associationName} · ${report.period}` : report.period, '', report.summary];
  for (const section of report.sections) {
    lines.push('', section.heading.toUpperCase(), section.content);
  }
  if (report.highlights.length > 0) lines.push('', 'HIGHLIGHTS', ...report.highlights.map((h) => `• ${h}`));
  if (report.recommendations && report.recommendations.length > 0) lines.push('', 'RECOMMENDATIONS', ...report.recommendations.map((r) => `• ${r}`));
  lines.push('', 'Written with the SocietyLedger AI assistant from the association’s own figures. Please check the figures against Reports before acting on them.');
  return lines.join('\n');
}
