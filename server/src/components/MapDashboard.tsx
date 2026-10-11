'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ComplaintCard, type ComplaintSummaryItem } from './ComplaintCard';
import { ComplaintDetailModal, type FullComplaintDetail } from './ComplaintDetailModal';
import { FilterTabs, type FilterOption } from './FilterTabs';

// Dynamically import map component with SSR disabled
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="map-loading-placeholder">
      <div className="spinner" />
      <p>Initializing Pune City GIS Map Canvas...</p>
    </div>
  ),
});

export function MapDashboard() {
  const [complaints, setComplaints] = useState<ComplaintSummaryItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected complaint details
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [fullDetail, setFullDetail] = useState<FullComplaintDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mobile layout view toggle
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');
  useEffect(() => {
    const complaintId = new URLSearchParams(window.location.search).get('complaint');
    if (complaintId) setSelectedComplaintId(complaintId);
  }, []);

  // Fetch summary complaints on mount
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/v1/complaints');
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch complaints`);
        const data = await res.json();
        if (!ignore) {
          setComplaints(Array.isArray(data) ? data : []);
          setIsLoadingList(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setListError(err instanceof Error ? err.message : 'Failed to load complaints');
          setIsLoadingList(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const res = await fetch('/api/v1/complaints');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch complaints`);
      const data = await res.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Failed to load complaints');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // Load full details when a complaint is selected
  const handleSelectComplaint = useCallback(async (id: string) => {
    setSelectedComplaintId(id);
    setIsModalOpen(true);
    setIsLoadingDetail(true);
    setDetailError(null);

    try {
      const res = await fetch(`/api/v1/complaints/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load details`);
      const detail = await res.json();
      setFullDetail(detail);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Error fetching full details');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Filtered complaints calculation
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Domain filter
      if (domainFilter !== 'ALL' && c.domain?.toUpperCase() !== domainFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'RESOLVED' && c.verification_status !== 'VERIFIED_RESOLVED') return false;
        if (statusFilter === 'ESCALATED' && c.verification_status !== 'VERIFIED_UNRESOLVED_ESCALATED') return false;
        if (
          statusFilter === 'PENDING' &&
          c.verification_status !== 'PENDING_TIMELOCK' &&
          c.verification_status !== 'AWAITING_CITIZEN_PHOTO'
        )
          return false;
      }

      // Search query (tracking ID, issue type, landmark, ward)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = c.tracking_id?.toLowerCase().includes(q);
        const matchesIssue = c.issue_type?.toLowerCase().includes(q);
        const matchesLandmark = c.address_landmark?.toLowerCase().includes(q);
        const matchesWard = c.ward_name?.toLowerCase().includes(q);
        return matchesId || matchesIssue || matchesLandmark || matchesWard;
      }

      return true;
    });
  }, [complaints, domainFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.verification_status === 'VERIFIED_RESOLVED').length;
    const urgent = complaints.filter(
      (c) =>
        c.urgency_level === 'CRITICAL_EMERGENCY' ||
        c.urgency_level === 'HIGH' ||
        c.urgency_level === 'EMERGENCY_24H'
    ).length;
    const trees = complaints.filter((c) => c.domain === 'TREES').length;
    const roads = complaints.filter((c) => c.domain === 'ROADS').length;
    const garbage = complaints.filter((c) => c.domain === 'GARBAGE').length;
    const noise = complaints.filter((c) => c.domain === 'NOISE').length;

    return { total, resolved, urgent, trees, roads, garbage, noise };
  }, [complaints]);

  // Domain options with dynamic counts
  const domainOptions: FilterOption[] = [
    { id: 'ALL', label: 'All Issues', icon: '🌐', count: stats.total },
    { id: 'TREES', label: 'Trees', icon: '🌳', count: stats.trees },
    { id: 'ROADS', label: 'Roads', icon: '🛣️', count: stats.roads },
    { id: 'GARBAGE', label: 'Garbage', icon: '♻️', count: stats.garbage },
    { id: 'NOISE', label: 'Noise', icon: '🔊', count: stats.noise },
  ];

  // Status options
  const statusOptions: FilterOption[] = [
    { id: 'ALL', label: 'All Statuses' },
    { id: 'PENDING', label: 'Active & Pending' },
    { id: 'RESOLVED', label: 'Resolved' },
    { id: 'ESCALATED', label: 'Escalated' },
  ];

  return (
    <div className="dashboard-container">
      {/* Top Navigation / Municipal Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-logo">🏛️</div>
          <div>
            <div className="brand-subtitle">PUNE MUNICIPAL CORPORATION CIVIC DASHBOARD</div>
            <h1 className="brand-title">Public Civic Grievance & Evidence Map</h1>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-stat-chip">
            <span className="stat-label">Filed Grievances</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="header-stat-chip urgent-stat">
            <span className="stat-label">Urgent Hazards</span>
            <span className="stat-value">{stats.urgent}</span>
          </div>
          <div className="header-stat-chip resolved-stat">
            <span className="stat-label">Resolved</span>
            <span className="stat-value">{stats.resolved}</span>
          </div>
          <button className="refresh-btn" onClick={handleRefresh} title="Refresh records" disabled={isLoadingList}>
            {isLoadingList ? '⌛' : '🔄'} Refresh
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="dashboard-controls">
        <div className="search-bar-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by Tracking ID (e.g. PUNE-FAST...), landmark, or issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filters-wrapper">
          <FilterTabs options={domainOptions} activeId={domainFilter} onSelect={setDomainFilter} />
          <FilterTabs options={statusOptions} activeId={statusFilter} onSelect={setStatusFilter} />
        </div>

        {/* Mobile View Switcher */}
        <div className="mobile-view-toggle">
          <button
            className={`mobile-toggle-btn ${mobileView === 'map' ? 'mobile-toggle-active' : ''}`}
            onClick={() => setMobileView('map')}
          >
            🗺️ Map View
          </button>
          <button
            className={`mobile-toggle-btn ${mobileView === 'list' ? 'mobile-toggle-active' : ''}`}
            onClick={() => setMobileView('list')}
          >
            📋 List View ({filteredComplaints.length})
          </button>
        </div>
      </div>

      {/* Main Content: Split Map + Sidebar Feed */}
      <div className="dashboard-content">
        {/* Left Sidebar: Feed of complaints */}
        <aside className={`dashboard-sidebar ${mobileView === 'list' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <div className="sidebar-header">
            <h3>Filed Complaints ({filteredComplaints.length})</h3>
            <span className="sidebar-hint">Click any complaint to load complete evidence</span>
          </div>

          {isLoadingList && (
            <div className="sidebar-loading">
              <div className="spinner" />
              <p>Fetching complaints from municipal repository...</p>
            </div>
          )}

          {listError && (
            <div className="sidebar-error">
              <p>⚠️ Error: {listError}</p>
              <button onClick={handleRefresh} className="retry-btn">
                Retry
              </button>
            </div>
          )}

          {!isLoadingList && !listError && filteredComplaints.length === 0 && (
            <div className="sidebar-empty">
              <span className="empty-icon">📂</span>
              <p>No complaints match the selected filters or search.</p>
              {(searchQuery || domainFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  className="reset-filters-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setDomainFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          <div className="complaint-feed-list">
            {filteredComplaints.map((item) => (
              <ComplaintCard
                key={item.id}
                complaint={item}
                isSelected={selectedComplaintId === item.id}
                onClick={() => handleSelectComplaint(item.id)}
              />
            ))}
          </div>
        </aside>

        {/* Right Area: Interactive GIS Leaflet Map */}
        <section className={`dashboard-map-section ${mobileView === 'map' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <MapComponent
            complaints={filteredComplaints}
            selectedComplaintId={selectedComplaintId}
            onSelectComplaint={handleSelectComplaint}
          />
        </section>
      </div>

      {/* Loadable Detailed Complaint Inspection Modal / Drawer */}
      {isModalOpen && (
        <ComplaintDetailModal
          complaint={fullDetail}
          isLoading={isLoadingDetail}
          error={detailError}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
