import React from 'react';

interface SectionDividerProps {
  icon: React.ReactNode;
  title: string;
  color?: 'blue' | 'purple' | 'teal' | 'green';
}

export function SectionDivider({ icon, title, color = 'teal' }: SectionDividerProps) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
    teal: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  };

  return (
    <div className="px-4 py-3 my-2">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClasses[color]}`}>
        <div className="flex-shrink-0">{icon}</div>
        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
      </div>
    </div>
  );
}
