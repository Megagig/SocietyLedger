'use client';

import { useState } from 'react';
import { Paper, Text, TextInput, Button, Badge, Table, Loader, Code, Accordion } from '@mantine/core';
import { IconSearch, IconBrain, IconDatabase, IconSparkles, IconUser, IconReceipt, IconCurrencyNaira } from '@tabler/icons-react';
import { aiApi, NLQueryResponse } from '@/lib/api/ai';
import { toast } from '@/lib/toast';

const EXAMPLE_QUERIES = [
  { query: 'Show me all active members', icon: <IconUser size={16} /> },
  { query: 'List all overdue transactions', icon: <IconReceipt size={16} /> },
  { query: 'What is our total income this year?', icon: <IconCurrencyNaira size={16} /> },
  { query: 'Members who joined in 2024', icon: <IconUser size={16} /> },
  { query: 'Pending transactions from last month', icon: <IconReceipt size={16} /> },
  { query: 'Show paid transactions this month', icon: <IconReceipt size={16} /> },
];

export default function AIQueryPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<NLQueryResponse | null>(null);

  const handleQuery = async () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await aiApi.executeQuery({ query: query.trim() });
      setResult(response.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to execute query';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleQuery();
    }
  };

  const getQueryTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      member: 'blue',
      transaction: 'green',
      financial: 'yellow',
      report: 'purple',
    };
    return <Badge color={colors[type] || 'gray'}>{type}</Badge>;
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      return value.toLocaleString('en-NG');
    }
    if (typeof value === 'object' && value instanceof Date) {
      return value.toLocaleDateString();
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleDateString();
    }
    return String(value);
  };

  const renderResultsTable = (results: any[]) => {
    if (!results || results.length === 0) {
      return (
        <Text c="dimmed" ta="center" py="xl">
          No results found
        </Text>
      );
    }

    const columns = Object.keys(results[0]).filter(key => 
      !key.startsWith('_') && key !== 'member' && key !== 'category'
    );

    const formatColumnName = (col: string) => 
      col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    const renderCellValue = (col: string, value: any) => {
      if (col === 'amount' || col === 'totalExpected' || col === 'totalCollected' || col === 'outstanding') {
        return <Text fw={500}>₦{formatValue(value)}</Text>;
      }
      if (col === 'status') {
        return (
          <Badge size="sm" color={
            value === 'active' || value === 'paid' ? 'green' :
            value === 'overdue' ? 'red' :
            value === 'pending' ? 'yellow' : 'gray'
          }>
            {value}
          </Badge>
        );
      }
      if (col === 'collectionRate') {
        return <Text>{formatValue(value)}%</Text>;
      }
      return formatValue(value);
    };

    return (
      <>
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {results.slice(0, 50).map((row, index) => (
            <div key={index} className="p-4 space-y-2">
              {columns.slice(0, 6).map((col) => (
                <div key={col} className="flex justify-between items-center">
                  <Text size="xs" c="dimmed">{formatColumnName(col)}</Text>
                  <div className="text-sm">{renderCellValue(col, row[col])}</div>
                </div>
              ))}
              {columns.length > 6 && (
                <Text size="xs" c="dimmed" ta="center" pt="xs">
                  +{columns.length - 6} more fields
                </Text>
              )}
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th key={col}>{formatColumnName(col)}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.slice(0, 50).map((row, index) => (
                <Table.Tr key={index}>
                  {columns.map((col) => (
                    <Table.Td key={col}>{renderCellValue(col, row[col])}</Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>

        {results.length > 50 && (
          <Text size="sm" c="dimmed" ta="center" py="sm">
            Showing 50 of {results.length} results
          </Text>
        )}
      </>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Natural Language Data Query
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          Query your association data using plain English
        </p>
      </div>

      {/* Query Input */}
      <Paper className="p-4 sm:p-6 mb-4 sm:mb-6 glass-card" withBorder>
        <div className="flex flex-col sm:flex-row gap-2">
          <TextInput
            placeholder="Ask a question like 'Show me all active members'..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            size="md"
            leftSection={<IconBrain size={18} />}
          />
          <Button
            onClick={handleQuery}
            loading={isLoading}
            size="md"
            leftSection={<IconSearch size={18} />}
            className="bg-gradient-to-r from-teal-500 to-green-500 w-full sm:w-auto"
          >
            Query
          </Button>
        </div>

        {/* Example Queries */}
        <div className="mt-4">
          <Text size="sm" c="dimmed" mb="xs">Try these examples:</Text>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example, index) => (
              <Button
                key={index}
                variant="light"
                size="xs"
                leftSection={example.icon}
                onClick={() => setQuery(example.query)}
                className="text-xs"
              >
                <span className="hidden sm:inline">{example.query}</span>
                <span className="sm:hidden">{example.query.length > 25 ? example.query.substring(0, 25) + '...' : example.query}</span>
              </Button>
            ))}
          </div>
        </div>
      </Paper>

      {/* Results */}
      {isLoading ? (
        <Paper className="p-8 sm:p-12 glass-card text-center" withBorder>
          <Loader size="lg" className="mx-auto mb-4" />
          <Text>Processing your query...</Text>
          <Text size="sm" c="dimmed">AI is interpreting your request and fetching data</Text>
        </Paper>
      ) : result ? (
        <div className="space-y-3 sm:space-y-4">
          {/* Query Interpretation */}
          <Paper className="p-3 sm:p-4 glass-card" withBorder>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <IconSparkles size={18} className="text-teal-500" />
                <Text fw={600} size="sm" className="sm:text-base">Query Interpretation</Text>
              </div>
              {getQueryTypeBadge(result.queryType)}
            </div>
            <Text size="xs" className="sm:text-sm" c="dimmed">{result.interpretation}</Text>
            <Badge size="xs" mt="xs">
              {result.tokensUsed.input + result.tokensUsed.output} tokens used
            </Badge>
          </Paper>

          {/* AI Explanation */}
          <Paper className="p-3 sm:p-4 bg-teal-50 dark:bg-teal-900/20" withBorder>
            <div className="flex items-center gap-2 mb-2">
              <IconBrain size={18} className="text-teal-600" />
              <Text fw={600} size="sm" className="sm:text-base">AI Explanation</Text>
            </div>
            <Text size="xs" className="sm:text-sm">{result.explanation}</Text>
          </Paper>

          {/* Results Table */}
          <Paper className="glass-card overflow-hidden" withBorder>
            <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconDatabase size={18} />
                  <Text fw={600} size="sm" className="sm:text-base">Results</Text>
                </div>
                <Badge size="sm">{result.results.length} records</Badge>
              </div>
            </div>
            {renderResultsTable(result.results)}
          </Paper>

          {/* Raw Data (Collapsible) */}
          <Accordion variant="separated">
            <Accordion.Item value="raw">
              <Accordion.Control icon={<IconDatabase size={18} />}>
                View Raw Data (JSON)
              </Accordion.Control>
              <Accordion.Panel>
                <Code block className="max-h-96 overflow-auto">
                  {JSON.stringify(result.results, null, 2)}
                </Code>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </div>
      ) : (
        <Paper className="p-8 sm:p-12 glass-card text-center" withBorder>
          <IconDatabase size={48} className="sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
          <Text size="md" className="sm:text-lg" fw={500} mb="xs">Query Your Data</Text>
          <Text size="xs" className="sm:text-sm" c="dimmed" mb="lg">
            Enter a natural language query above to search your association data.
            The AI will interpret your request and return relevant results.
          </Text>
          
          {/* Safety Notice */}
          <Paper className="p-3 max-w-md mx-auto bg-blue-50 dark:bg-blue-900/20" withBorder>
            <Text size="xs" fw={500}>🔒 Read-Only Queries</Text>
            <Text size="xs" c="dimmed">
              All queries are read-only and scoped to your association. 
              The AI cannot modify any data.
            </Text>
          </Paper>
        </Paper>
      )}
    </div>
  );
}
