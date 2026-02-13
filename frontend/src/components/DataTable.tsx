import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string;
}

function DataTable<T>({ columns, data, loading, page, totalPages, onPageChange, onRowClick, keyExtractor }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden backdrop-blur-sm">
        <div className="animate-pulse">
          <div className="h-12 bg-slate-900/50 border-b border-slate-700/50" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 border-b border-slate-700/30 flex items-center px-4 gap-4">
              <div className="h-4 bg-slate-700 rounded w-1/4" />
              <div className="h-4 bg-slate-700 rounded w-1/6" />
              <div className="h-4 bg-slate-700 rounded w-1/5" />
              <div className="h-4 bg-slate-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-[2px] overflow-hidden backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-900/50 border-b border-slate-700/50 text-slate-400">
              {columns.map(col => (
                <th key={col.key} className={clsx('p-4 font-medium', col.className)}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {data.map(item => (
              <tr
                key={keyExtractor(item)}
                className={clsx('hover:bg-slate-800/30 transition-colors', onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map(col => (
                  <td key={col.key} className={clsx('p-4', col.className)}>
                    {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages != null && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
          <span className="text-sm text-slate-400">
            Page {(page || 0) + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange?.(Math.max(0, (page || 0) - 1))}
              disabled={page === 0}
              className="p-2 rounded-[2px] bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange?.((page || 0) + 1)}
              disabled={(page || 0) + 1 >= (totalPages || 1)}
              className="p-2 rounded-[2px] bg-slate-700/50 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
