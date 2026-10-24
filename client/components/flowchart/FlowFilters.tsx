// client/components/flowchart/FlowFilters.tsx
'use client';

import React from 'react';
import { FlowFilter } from '@/types/flowchart';

interface FlowFiltersProps {
  activeFilter: FlowFilter;
  onFilterChange: (filter: FlowFilter) => void;
  counts?: {
    all: number;
    decisions?: number;
    loops?: number;
    functions?: number;
    calls?: number;
    files?: number;
    dependencies?: number;
  };
  isProjectMode?: boolean;
}

export default function FlowFilters({
  activeFilter,
  onFilterChange,
  counts = { all: 0 },
  isProjectMode = false
}: FlowFiltersProps) {
  const fileFilters: Array<{ id: FlowFilter; label: string; count?: number }> = [
    { id: 'ALL',       label: 'All',       count: counts.all },
    { id: 'DECISIONS', label: 'Decisions', count: counts.decisions },
    { id: 'LOOPS',     label: 'Loops',     count: counts.loops },
    { id: 'FUNCTIONS', label: 'Functions', count: counts.functions },
    { id: 'CALLS',     label: 'Calls',     count: counts.calls },
  ];

  const projectFilters: Array<{ id: FlowFilter; label: string; count?: number }> = [
    { id: 'ALL',          label: 'All',          count: counts.all },
    { id: 'FILES',        label: 'Files',        count: counts.files },
    { id: 'FUNCTIONS',    label: 'Functions',    count: counts.functions },
    { id: 'CALLS',        label: 'Calls',        count: counts.calls },
    { id: 'DEPENDENCIES', label: 'Dependencies', count: counts.dependencies },
  ];

  const filters = isProjectMode ? projectFilters : fileFilters;

  return (
    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-[#0d1117] border-b border-[#30363d]/60 overflow-x-auto select-none">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#484f58] mr-0.5 shrink-0">
        FILTER
      </span>
      {filters.map((f) => {
        const isActive = activeFilter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all shrink-0 ${
              isActive
                ? 'bg-[#1f6feb] text-white'
                : 'text-[#7d8590] hover:text-[#c9d1d9] hover:bg-[#21262d]'
            }`}
          >
            <span>{f.label}</span>
            {f.count !== undefined && f.count > 0 && (
              <span className={`px-1 rounded-full text-[9px] ${
                isActive ? 'bg-white/20 text-white' : 'bg-[#21262d] text-[#7d8590]'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
