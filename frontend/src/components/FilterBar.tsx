import React from 'react';
import { Search } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, values, onFilterChange, searchValue, onSearchChange, searchPlaceholder }) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onSearchChange && (
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchValue || ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || 'Search...'}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-[2px] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500/50"
          />
        </div>
      )}

      {filters.map(filter => (
        <select
          key={filter.key}
          value={values[filter.key] || ''}
          onChange={e => onFilterChange(filter.key, e.target.value)}
          className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-[2px] text-sm text-white focus:outline-none focus:border-primary-500/50 appearance-none cursor-pointer"
        >
          <option value="">{filter.label}</option>
          {filter.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
};

export default FilterBar;
