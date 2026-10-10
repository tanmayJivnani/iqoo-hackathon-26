'use client';

import React from 'react';

export type FilterOption = {
  id: string;
  label: string;
  icon?: string;
  count?: number;
};

export function FilterTabs({
  options,
  activeId,
  onSelect,
}: {
  options: FilterOption[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="filter-tabs-container">
      {options.map((opt) => {
        const isActive = opt.id === activeId;
        return (
          <button
            key={opt.id}
            type="button"
            className={`filter-tab-pill ${isActive ? 'filter-tab-pill-active' : ''}`}
            onClick={() => onSelect(opt.id)}
          >
            {opt.icon && <span className="tab-icon">{opt.icon}</span>}
            <span className="tab-label">{opt.label}</span>
            {opt.count !== undefined && <span className="tab-count">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
