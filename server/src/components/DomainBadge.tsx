'use client';

import React from 'react';

export type DomainType = 'TREES' | 'ROADS' | 'GARBAGE' | 'NOISE' | string;

export function getDomainIcon(domain: DomainType): string {
  switch (domain?.toUpperCase()) {
    case 'TREES':
      return '🌳';
    case 'ROADS':
      return '🛣️';
    case 'GARBAGE':
      return '♻️';
    case 'NOISE':
      return '🔊';
    default:
      return '📍';
  }
}

export function formatDomainName(domain: DomainType): string {
  switch (domain?.toUpperCase()) {
    case 'TREES':
      return 'Tree Protection';
    case 'ROADS':
      return 'Roads & Infrastructure';
    case 'GARBAGE':
      return 'Garbage & Waste';
    case 'NOISE':
      return 'Noise Pollution';
    default:
      return domain || 'Civic Issue';
  }
}

export function formatIssueName(issueType: string): string {
  if (!issueType) return 'Civic Issue';
  return issueType
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function DomainBadge({ domain, showIcon = true }: { domain: DomainType; showIcon?: boolean }) {
  const icon = getDomainIcon(domain);
  const name = formatDomainName(domain);
  const domainKey = (domain || 'default').toLowerCase();

  return (
    <span className={`domain-badge domain-badge-${domainKey}`}>
      {showIcon && <span className="domain-icon">{icon}</span>}
      <span className="domain-label">{name}</span>
    </span>
  );
}
