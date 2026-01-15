'use client';

import { useState } from 'react';

interface TreeNode {
  id: number;
  title: string;
  slug: string;
  status: string;
  children?: TreeNode[];
}

interface DocTreeProps {
  data: TreeNode[];
  onNodeClick?: (node: TreeNode) => void;
  renderNode?: (node: TreeNode, level: number) => React.ReactNode;
  defaultExpanded?: boolean;
}

export default function DocTree({ data, onNodeClick, renderNode, defaultExpanded = true }: DocTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(
    new Set(defaultExpanded ? data.map(n => n.id) : [])
  );

  const toggleNode = (nodeId: number) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    if (renderNode) {
      return renderNode(node, level);
    }

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            }
            onNodeClick?.(node);
          }}
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition"
          style={{ paddingLeft: `${12 + level * 24}px` }}
        >
          {hasChildren && (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {!hasChildren && <div className="w-4 h-4" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {node.title}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                node.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
              }`}>
                {node.status}
              </span>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Documentation Tree
        </h3>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {data.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p>No pages in tree</p>
          </div>
        ) : (
          <div>{data.map(node => renderTreeNode(node))}</div>
        )}
      </div>
    </div>
  );
}
