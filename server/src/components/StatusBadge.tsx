'use client';

import React from 'react';

export type StatusType =
  | 'PENDING_TIMELOCK'
  | 'AWAITING_CITIZEN_PHOTO'
  | 'VERIFIED_RESOLVED'
  | 'VERIFIED_UNRESOLVED_ESCALATED'
  | 'REPORTED'
  | string;

export function formatStatusLabel(status: StatusType): string {
  switch (status) {
    case 'PENDING_TIMELOCK':
      return 'Pending Timelock';
    case 'AWAITING_CITIZEN_PHOTO':
      return 'Awaiting Verification';
    case 'VERIFIED_RESOLVED':
      return 'Verified Resolved';
    case 'VERIFIED_UNRESOLVED_ESCALATED':
      return 'Escalated to Dept';
    case 'REPORTED':
      return 'Reported';
    default:
      return status?.replace(/_/g, ' ') || 'Reported';
  }
}

export function getStatusColorClass(status: StatusType): string {
  switch (status) {
    case 'VERIFIED_RESOLVED':
      return 'badge-status-resolved';
    case 'VERIFIED_UNRESOLVED_ESCALATED':
      return 'badge-status-escalated';
    case 'PENDING_TIMELOCK':
      return 'badge-status-pending';
    case 'AWAITING_CITIZEN_PHOTO':
      return 'badge-status-awaiting';
    default:
      return 'badge-status-neutral';
  }
}

export function StatusBadge({ status, size = 'md' }: { status: StatusType; size?: 'sm' | 'md' }) {
  const label = formatStatusLabel(status);
  const colorClass = getStatusColorClass(status);
  return (
    <span className={`status-badge ${colorClass} ${size === 'sm' ? 'status-badge-sm' : ''}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}
