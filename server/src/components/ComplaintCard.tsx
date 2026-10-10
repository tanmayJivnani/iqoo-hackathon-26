'use client';

import React from 'react';
import { StatusBadge } from './StatusBadge';
import { DomainBadge, formatIssueName } from './DomainBadge';

export type ComplaintSummaryItem = {
  id: string;
  tracking_id: string;
  domain: string;
  reverification_required: boolean;
  issue_type: string;
  urgency_level: string;
  address_landmark: string;
  verification_status: string;
  reverification_due_at: string | null;
  created_at: string;
  latitude: number;
  longitude: number;
  ward_name?: string;
  has_photos?: boolean;
  has_audio?: boolean;
  witness_count?: number;
};

export function ComplaintCard({
  complaint,
  isSelected,
  onClick,
}: {
  complaint: ComplaintSummaryItem;
  isSelected?: boolean;
  onClick: () => void;
}) {
  const formattedDate = new Date(complaint.created_at).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isUrgent =
    complaint.urgency_level === 'CRITICAL_EMERGENCY' ||
    complaint.urgency_level === 'HIGH' ||
    complaint.urgency_level === 'EMERGENCY_24H';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`complaint-card ${isSelected ? 'complaint-card-selected' : ''}`}
    >
      <div className="complaint-card-header">
        <DomainBadge domain={complaint.domain} />
        <StatusBadge status={complaint.verification_status} size="sm" />
      </div>

      <div className="complaint-card-title">
        <h4>{formatIssueName(complaint.issue_type)}</h4>
        {isUrgent && <span className="urgency-pill">URGENT</span>}
      </div>

      <p className="complaint-card-address" title={complaint.address_landmark}>
        📍 {complaint.address_landmark || 'Pune location recorded'}
      </p>

      <div className="complaint-card-footer">
        <span className="complaint-card-id">{complaint.tracking_id}</span>
        <div className="complaint-card-meta">
          {complaint.has_photos && <span title="Photos attached">📷</span>}
          {complaint.has_audio && <span title="Audio recorded">🎙️</span>}
          <span className="complaint-card-date">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
