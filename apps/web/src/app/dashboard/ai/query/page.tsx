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

    return (
      <div className="overflow-x-auto">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th key={col}>
                  {col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.slice(0, 50).map((row, index) => (
              <Table.Tr key={index}>
                {columns.map((col) => (
                  <Table.Td key={col}>
                    {col === 'amount' || col === 'totalExpected' || col === 'totalCollected' || col === 'outstanding' ? (
                      <Text fw={500}>₦{formatValue(row[col])}</Text>
                    ) : col === 'status' ? (
                      <Badge size="sm" color={
                        row[col] === 'active' || row[col] === 'paid' ? 'green' :
                        row[col] === 'overdue' ? 'red' :
                        row[col] === 'pending' ? 'yellow' : 'gray'
                      }>
                        {row[col]}
                      </Badge>
                    ) : col === 'collectionRate' ? (
                      <Text>{formatValue(row[col])}%</Text>
                    ) : (
                      formatValue(row[col])
                    )}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {results.length > 50 && (
          <Text size="sm" c="dimmed" ta="center" py="sm">
            Showing 50 of {results.length} results
          </Text>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Natural Language Data Query
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Query your association data using plain English
        </p>
      </div>

      {/* Query Input */}
      <Paper className="p-6 mb-6 glass-card" withBorder>
        <div className="flex gap-2">
          <TextInput
            placeholder="Ask a question like 'Show me all active members' or 'List overdue transactions'"
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
            className="bg-gradient-to-r from-teal-500 to-green-500"
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
              >
                {example.query}
              </Button>
            ))}
          </div>
        </div>
      </Paper>

      {/* Results */}
      {isLoading ? (
        <Paper className="p-12 glass-card text-center" withBorder>
          <Loader size="lg" className="mx-auto mb-4" />
          <Text>Processing your query...</Text>
          <Text size="sm" c="dimmed">AI is interpreting your request and fetching data</Text>
        </Paper>
      ) : result ? (
        <div className="space-y-4">
          {/* Query Interpretation */}
          <Paper className="p-4 glass-card" withBorder>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconSparkles size={18} className="text-teal-500" />
                <Text fw={600}>Query Interpretation</Text>
              </div>
              {getQueryTypeBadge(result.queryType)}
            </div>
            <Text size="sm" c="dimmed">{result.interpretation}</Text>
            <Badge size="xs" mt="xs">
              {result.tokensUsed.input + result.tokensUsed.output} tokens used
            </Badge>
          </Paper>

          {/* AI Explanation */}
          <Paper className="p-4 bg-teal-50 dark:bg-teal-900/20" withBorder>
            <div className="flex items-center gap-2 mb-2">
              <IconBrain size={18} className="text-teal-600" />
              <Text fw={600}>AI Explanation</Text>
            </div>
            <Text size="sm">{result.explanation}</Text>
          </Paper>

          {/* Results Table */}
          <Paper className="glass-card overflow-hidden" withBorder>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconDatabase size={18} />
                  <Text fw={600}>Results</Text>
                </div>
                <Badge>{result.results.length} records</Badge>
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
        <Paper className="p-12 glass-card text-center" withBorder>
          <IconDatabase size={64} className="mx-auto mb-4 text-gray-400" />
          <Text size="lg" fw={500} mb="xs">Query Your Data</Text>
          <Text size="sm" c="dimmed" mb="lg">
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
