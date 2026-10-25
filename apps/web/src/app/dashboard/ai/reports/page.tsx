'use client';

import { useState } from 'react';
import { Paper, Text, Button, Select, Checkbox, Loader, Badge, Accordion, List, ThemeIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSparkles, IconFileAnalytics, IconDownload, IconCheck, IconBulb, IconAlertCircle } from '@tabler/icons-react';
import { aiApi, AIReportResponse } from '@/lib/api/ai';
import { toast } from '@/lib/toast';

const REPORT_TYPES = [
  { value: 'monthly_summary', label: 'Monthly Summary', description: 'Overview of monthly financial activity' },
  { value: 'quarterly_review', label: 'Quarterly Review', description: 'Quarter-over-quarter analysis' },
  { value: 'annual_report', label: 'Annual Report', description: 'Comprehensive year-end report' },
  { value: 'treasurer_handover', label: 'Treasurer Handover', description: 'Leadership transition document' },
];

export default function AIReportsPage() {
  const [reportType, setReportType] = useState<string | null>('monthly_summary');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<AIReportResponse | null>(null);

  const handleGenerate = async () => {
    if (!reportType) {
      toast.error('Please select a report type');
      return;
    }

    setIsLoading(true);
    setReport(null);

    try {
      const response = await aiApi.generateReport({
        reportType: reportType as any,
        period: startDate && endDate ? {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        } : undefined,
        includeRecommendations,
      });

      setReport(response.data);
      toast.success('Report generated successfully!');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to generate report';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!report) return;

    // Create a simple text export
    let content = `${report.title}\n${'='.repeat(report.title.length)}\n\n`;
    content += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n\n`;
    content += `SUMMARY\n${'-'.repeat(7)}\n${report.summary}\n\n`;
    
    report.sections.forEach(section => {
      content += `${section.heading.toUpperCase()}\n${'-'.repeat(section.heading.length)}\n${section.content}\n\n`;
    });

    content += `KEY HIGHLIGHTS\n${'-'.repeat(14)}\n`;
    report.highlights.forEach((h, i) => {
      content += `${i + 1}. ${h}\n`;
    });

    if (report.recommendations && report.recommendations.length > 0) {
      content += `\nRECOMMENDATIONS\n${'-'.repeat(15)}\n`;
      report.recommendations.forEach((r, i) => {
        content += `${i + 1}. ${r}\n`;
      });
    }

    // Download as text file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          AI Smart Reports
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Generate AI-powered financial reports and summaries
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Configuration Panel */}
        <Paper className="p-4 sm:p-6 glass-card" withBorder>
          <Text size="lg" fw={600} mb="md">Report Configuration</Text>

          <div className="space-y-4">
            <Select
              label="Report Type"
              placeholder="Select report type"
              data={REPORT_TYPES.map(t => ({ value: t.value, label: t.label }))}
              value={reportType}
              onChange={setReportType}
            />

            {reportType && (
              <Text size="xs" c="dimmed">
                {REPORT_TYPES.find(t => t.value === reportType)?.description}
              </Text>
            )}

            <DatePickerInput
              label="Start Date (Optional)"
              placeholder="Pick start date"
              value={startDate}
              onChange={setStartDate}
              clearable
            />

            <DatePickerInput
              label="End Date (Optional)"
              placeholder="Pick end date"
              value={endDate}
              onChange={setEndDate}
              clearable
              minDate={startDate || undefined}
            />

            <Checkbox
              label="Include AI Recommendations"
              checked={includeRecommendations}
              onChange={(e) => setIncludeRecommendations(e.currentTarget.checked)}
            />

            <Button
              fullWidth
              onClick={handleGenerate}
              loading={isLoading}
              leftSection={<IconSparkles size={18} />}
              className="bg-gradient-to-r from-teal-500 to-green-500"
            >
              Generate Report
            </Button>
          </div>

          {/* Report Type Cards - Hidden on mobile when report is shown */}
          <div className={`mt-6 space-y-2 ${report ? 'hidden lg:block' : ''}`}>
            <Text size="sm" fw={500} c="dimmed">Available Report Types</Text>
            {REPORT_TYPES.map((type) => (
              <Paper
                key={type.value}
                className={`p-2 sm:p-3 cursor-pointer transition-all ${
                  reportType === type.value 
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                withBorder
                onClick={() => setReportType(type.value)}
              >
                <Text size="sm" fw={500}>{type.label}</Text>
                <Text size="xs" c="dimmed">{type.description}</Text>
              </Paper>
            ))}
          </div>
        </Paper>

        {/* Report Display */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <Paper className="p-8 sm:p-12 glass-card text-center" withBorder>
              <Loader size="lg" className="mx-auto mb-4" />
              <Text size="lg" fw={500}>Generating your report...</Text>
              <Text size="sm" c="dimmed">This may take a few seconds</Text>
            </Paper>
          ) : report ? (
            <Paper className="p-4 sm:p-6 glass-card" withBorder>
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                <div>
                  <Text size="lg" className="sm:text-xl" fw={700}>{report.title}</Text>
                  <Text size="xs" className="sm:text-sm" c="dimmed">
                    Generated on {new Date(report.generatedAt).toLocaleString()}
                  </Text>
                  <Badge size="sm" mt="xs">
                    {report.tokensUsed.input + report.tokensUsed.output} tokens used
                  </Badge>
                </div>
                <Button
                  variant="light"
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExport}
                  className="w-full sm:w-auto"
                >
                  Export
                </Button>
              </div>

              {/* Summary */}
              <Paper className="p-3 sm:p-4 mb-4 sm:mb-6 bg-teal-50 dark:bg-teal-900/20" withBorder>
                <Text size="sm" fw={600} mb="xs">Executive Summary</Text>
                <Text size="sm">{report.summary}</Text>
              </Paper>

              {/* Sections */}
              <Accordion variant="separated" mb="lg">
                {report.sections.map((section, index) => (
                  <Accordion.Item key={index} value={`section-${index}`}>
                    <Accordion.Control icon={<IconFileAnalytics size={18} />}>
                      {section.heading}
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {section.content}
                      </Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>

              {/* Highlights */}
              <Paper className="p-3 sm:p-4 mb-4 sm:mb-6" withBorder>
                <Text size="sm" fw={600} mb="sm">Key Highlights</Text>
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon color="green" size={20} radius="xl">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  {report.highlights.map((highlight, index) => (
                    <List.Item key={index}>{highlight}</List.Item>
                  ))}
                </List>
              </Paper>

              {/* Recommendations */}
              {report.recommendations && report.recommendations.length > 0 && (
                <Paper className="p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20" withBorder>
                  <Text size="sm" fw={600} mb="sm">AI Recommendations</Text>
                  <List
                    spacing="xs"
                    size="sm"
                    icon={
                      <ThemeIcon color="yellow" size={20} radius="xl">
                        <IconBulb size={12} />
                      </ThemeIcon>
                    }
                  >
                    {report.recommendations.map((rec, index) => (
                      <List.Item key={index}>{rec}</List.Item>
                    ))}
                  </List>
                </Paper>
              )}
            </Paper>
          ) : (
            <Paper className="p-8 sm:p-12 glass-card text-center" withBorder>
              <IconFileAnalytics size={48} className="mx-auto mb-4 text-gray-400 sm:hidden" />
              <IconFileAnalytics size={64} className="mx-auto mb-4 text-gray-400 hidden sm:block" />
              <Text size="lg" fw={500} mb="xs">No Report Generated</Text>
              <Text size="sm" c="dimmed">
                Select a report type and click &quot;Generate Report&quot; to create an AI-powered financial report.
              </Text>
            </Paper>
          )}
        </div>
      </div>
    </div>
  );
}
