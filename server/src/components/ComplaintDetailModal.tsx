'use client';

import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { DomainBadge, formatIssueName } from './DomainBadge';

export type FullComplaintDetail = {
  id: string;
  tracking_id: string;
  domain?: string;
  issue_type: string;
  urgency_level: string;
  verification_status: string;
  address_landmark: string;
  ward_name?: string;
  latitude: number;
  longitude: number;
  gps_accuracy_m?: number | null;
  sensor_tilt_angle?: number | null;
  photo_urls?: string[];
  audio_url?: string | null;
  noise_evidence?: {
    duration_ms: number;
    average_dbfs: number;
    peak_dbfs: number;
    average_dba?: number;
    peak_dba?: number;
    sample_count: number;
    unit: string;
    near_sensitive_site?: boolean;
    site_label?: string;
    measurement_method?: string;
    night_time?: boolean;
  } | null;
  routed_authority?: {
    name: string;
    role: string;
    email: string;
    whatsapp: string;
    emergency_phone?: string | null;
  };
  legal_citations?: string[];
  draft_subject_en?: string;
  draft_body_en?: string;
  draft_summary_mr?: string;
  visual_damage_summary?: string | null;
  estimated_tree_species?: string | null;
  witness_count?: number;
  pdf_path?: string | null;
  created_at: string;
  reverification_due_at?: string | null;
};

export function ComplaintDetailModal({
  complaint,
  isLoading,
  error,
  onClose,
}: {
  complaint: FullComplaintDetail | null;
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (!complaint && !isLoading && !error) return null;

  const handleCopyTrackingId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title-row">
            <span className="drawer-subtitle">CIVIC RECORD INSPECTION</span>
            <button className="drawer-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
          {complaint && (
            <div className="drawer-tracking-bar">
              <span className="tracking-id-label">{complaint.tracking_id}</span>
              <button
                className="copy-btn"
                onClick={() => handleCopyTrackingId(complaint.tracking_id)}
                title="Copy tracking ID"
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          )}
        </div>

        <div className="drawer-body">
          {isLoading && (
            <div className="drawer-loading">
              <div className="spinner" />
              <p>Loading complaint evidence & authority routing...</p>
            </div>
          )}

          {error && (
            <div className="drawer-error">
              <p>⚠️ Failed to load complaint details.</p>
              <span className="error-text">{error}</span>
            </div>
          )}

          {complaint && !isLoading && (
            <div className="complaint-detail-content">
              {/* Badges & Urgency */}
              <div className="detail-tags-row">
                <DomainBadge domain={complaint.domain || 'CIVIC'} />
                <StatusBadge status={complaint.verification_status} />
                <span
                  className={`urgency-badge ${
                    complaint.urgency_level === 'CRITICAL_EMERGENCY'
                      ? 'urgency-critical'
                      : complaint.urgency_level === 'HIGH'
                      ? 'urgency-high'
                      : 'urgency-normal'
                  }`}
                >
                  ⚡ {complaint.urgency_level.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Main Issue Title */}
              <h2 className="detail-heading">{formatIssueName(complaint.issue_type)}</h2>

              {/* Location Card */}
              <div className="detail-section location-card">
                <div className="section-title">📍 Location & Geo-Coordinates</div>
                <div className="location-info">
                  <div className="location-name">{complaint.address_landmark}</div>
                  <div className="location-sub">Ward: {complaint.ward_name || 'Pune Municipal Corporation'}</div>
                  <div className="coordinates-row">
                    <span>
                      GPS: {complaint.latitude?.toFixed(5)}, {complaint.longitude?.toFixed(5)}
                    </span>
                    {complaint.gps_accuracy_m && (
                      <span className="gps-accuracy">±{complaint.gps_accuracy_m.toFixed(1)}m</span>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="map-link-btn"
                    >
                      Open in Maps ↗
                    </a>
                  </div>
                </div>
              </div>

              {/* Evidence Photos */}
              {complaint.photo_urls && complaint.photo_urls.length > 0 && (
                <div className="detail-section">
                  <div className="section-title">📷 Attached Photographic Evidence ({complaint.photo_urls.length})</div>
                  <div className="photo-gallery">
                    {complaint.photo_urls.map((photoUrl, index) => (
                      <div
                        key={index}
                        className="photo-thumb-wrap"
                        onClick={() => setSelectedPhoto(photoUrl)}
                        title="Click to view full photo"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl} alt={`Evidence ${index + 1}`} className="photo-thumb" />
                        <span className="photo-overlay-tag">Photo #{index + 1}</span>
                      </div>
                    ))}
                  </div>
                  {complaint.visual_damage_summary && (
                    <div className="ai-damage-summary">
                      <strong>AI Vision Observation:</strong> {complaint.visual_damage_summary}
                    </div>
                  )}
                </div>
              )}

              {/* Evidence Audio / Decibel Readings */}
              {(complaint.audio_url || complaint.noise_evidence) && (
                <div className="detail-section audio-section">
                  <div className="section-title">🔊 Audio Evidence & Noise Assessment</div>
                  {complaint.audio_url && (
                    <div className="audio-player-wrap">
                      <audio controls src={complaint.audio_url} className="custom-audio-player" />
                    </div>
                  )}
                  {complaint.noise_evidence && (
                    <div className="noise-metrics-grid">
                      <div className="metric-box">
                        <span className="metric-label">Average Sound</span>
                        <span className="metric-value">
                          {complaint.noise_evidence.average_dba != null
                            ? `${complaint.noise_evidence.average_dba.toFixed(1)} dBA`
                            : `${complaint.noise_evidence.average_dbfs.toFixed(1)} dBFS`}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Peak Sound</span>
                        <span className="metric-value">
                          {complaint.noise_evidence.peak_dba != null
                            ? `${complaint.noise_evidence.peak_dba.toFixed(1)} dBA`
                            : `${complaint.noise_evidence.peak_dbfs.toFixed(1)} dBFS`}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Time Period</span>
                        <span className="metric-value">
                          {complaint.noise_evidence.night_time ? '🌙 Night-time' : '☀️ Day-time'}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Sensitive Zone</span>
                        <span className="metric-value">
                          {complaint.noise_evidence.near_sensitive_site ? '⚠️ Yes (Hospital/School)' : 'Standard'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Routed Authority Card */}
              {complaint.routed_authority && (
                <div className="detail-section authority-card">
                  <div className="section-title">🏛️ Routed Municipal Authority</div>
                  <div className="authority-name">{complaint.routed_authority.name}</div>
                  <div className="authority-role">{complaint.routed_authority.role}</div>
                  <div className="authority-contacts">
                    {complaint.routed_authority.emergency_phone && (
                      <div className="contact-item">
                        <span>📞 Emergency Line:</span>
                        <a href={`tel:${complaint.routed_authority.emergency_phone}`}>
                          {complaint.routed_authority.emergency_phone}
                        </a>
                      </div>
                    )}
                    {complaint.routed_authority.email && (
                      <div className="contact-item">
                        <span>✉️ Email:</span>
                        <a href={`mailto:${complaint.routed_authority.email}`}>{complaint.routed_authority.email}</a>
                      </div>
                    )}
                    {complaint.routed_authority.whatsapp && (
                      <div className="contact-item">
                        <span>💬 WhatsApp:</span>
                        <a
                          href={`https://wa.me/${complaint.routed_authority.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          +{complaint.routed_authority.whatsapp}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Statutory Legal Citations */}
              {complaint.legal_citations && complaint.legal_citations.length > 0 && (
                <div className="detail-section">
                  <div className="section-title">⚖️ Statutory Legal Grounding</div>
                  <div className="citations-list">
                    {complaint.legal_citations.map((cite, idx) => (
                      <div key={idx} className="citation-pill">
                        📜 {cite}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Notice English & Marathi */}
              <div className="detail-section notice-draft-section">
                <div className="section-title">📝 Generated Legal Notice Draft</div>
                {complaint.draft_subject_en && (
                  <div className="notice-subject">
                    <strong>Subject:</strong> {complaint.draft_subject_en}
                  </div>
                )}
                {complaint.draft_body_en && (
                  <div className="notice-body-en">
                    <pre>{complaint.draft_body_en}</pre>
                  </div>
                )}
                {complaint.draft_summary_mr && (
                  <div className="notice-summary-mr">
                    <span className="marathi-tag">मराठी गोषवारा (Marathi Summary)</span>
                    <p>{complaint.draft_summary_mr}</p>
                  </div>
                )}
              </div>

              {/* PDF Download Button */}
              {complaint.pdf_path && (
                <div className="detail-section pdf-action-section">
                  <a
                    href={`/api/v1/complaints/${encodeURIComponent(complaint.id)}/download-pdf`}
                    download
                    className="download-pdf-button"
                  >
                    📄 Download Official Notice PDF
                  </a>
                </div>
              )}

              {/* Audit Timelock Info */}
              <div className="detail-section timelock-section">
                <div className="timelock-row">
                  <span>📅 Filed: {new Date(complaint.created_at).toLocaleString('en-IN')}</span>
                  {complaint.reverification_due_at && (
                    <span>
                      ⏳ Re-verification Due: {new Date(complaint.reverification_due_at).toLocaleString('en-IN')}
                    </span>
                  )}
                  <span>👥 Witnesses: {complaint.witness_count ?? 1}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lightbox for Full Photo Preview */}
        {selectedPhoto && (
          <div className="lightbox-overlay" onClick={() => setSelectedPhoto(null)}>
            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setSelectedPhoto(null)}>
                ✕
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedPhoto} alt="Full evidence view" className="lightbox-img" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
