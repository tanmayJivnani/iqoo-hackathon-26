'use client';

import React, { useEffect, useRef } from 'react';
import type { ComplaintSummaryItem } from './ComplaintCard';
import { getDomainIcon, formatIssueName } from './DomainBadge';
import { formatStatusLabel } from './StatusBadge';

// Pune City Center coordinates
const DEFAULT_CENTER: [number, number] = [18.5204, 73.8567];
const DEFAULT_ZOOM = 12;
const STREET_ZOOM = 19;

export default function MapComponent({
  complaints,
  selectedComplaintId,
  onSelectComplaint,
}: {
  complaints: ComplaintSummaryItem[];
  selectedComplaintId: string | null;
  onSelectComplaint: (id: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<{ [id: string]: any }>({});
  const selectedIdRef = useRef(selectedComplaintId);
  selectedIdRef.current = selectedComplaintId;

  useEffect(() => {
    let isMounted = true;

    // Dynamically load Leaflet on client-side
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // If map is already initialized, skip initialization
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear existing markers
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};

      const validComplaints = complaints.filter(
        (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number' && !isNaN(c.latitude) && !isNaN(c.longitude)
      );

      const latLngs: [number, number][] = [];

      validComplaints.forEach((c) => {
        const iconEmoji = getDomainIcon(c.domain);
        const domainClass = (c.domain || 'trees').toLowerCase();
        const isUrgent =
          c.urgency_level === 'CRITICAL_EMERGENCY' ||
          c.urgency_level === 'HIGH' ||
          c.urgency_level === 'EMERGENCY_24H';

        const customIcon = L.divIcon({
          className: 'custom-map-marker-container',
          html: `
            <div class="map-pin-bubble map-pin-${domainClass} ${isUrgent ? 'map-pin-urgent' : ''}">
              <span class="map-pin-icon">${iconEmoji}</span>
            </div>
            <div class="map-pin-pointer"></div>
          `,
          iconSize: [36, 42],
          iconAnchor: [18, 42],
          popupAnchor: [0, -42],
        });

        const marker = L.marker([c.latitude, c.longitude], { icon: customIcon });

        const popupContent = document.createElement('div');
        popupContent.className = 'map-popup-card';
        popupContent.innerHTML = `
          <div class="map-popup-header">
            <span class="popup-domain-tag">${iconEmoji} ${c.domain || 'CIVIC'}</span>
            <span class="popup-status-tag">${formatStatusLabel(c.verification_status)}</span>
          </div>
          <h4 class="popup-title">${formatIssueName(c.issue_type)}</h4>
          <p class="popup-address">📍 ${c.address_landmark || 'Pune'}</p>
          <div class="popup-meta">
            <span class="popup-id">${c.tracking_id}</span>
          </div>
          <button class="popup-inspect-btn">View Complete Evidence &rarr;</button>
        `;

        const inspectBtn = popupContent.querySelector('.popup-inspect-btn');
        if (inspectBtn) {
          inspectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectComplaint(c.id);
          });
        }

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          onSelectComplaint(c.id);
        });

        marker.addTo(map);
        markersRef.current[c.id] = marker;
        latLngs.push([c.latitude, c.longitude]);
      });

      // Fit map bounds if there are markers, or default to Pune
      if (latLngs.length > 0) {
        try {
          const bounds = L.latLngBounds(latLngs);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: STREET_ZOOM });
        } catch {
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        }
      } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
      // Selection may arrive before the asynchronous Leaflet initialization.
      const focused = validComplaints.find(c => c.id === selectedIdRef.current);
      if (focused) {
        map.setView([focused.latitude, focused.longitude], STREET_ZOOM);
        markersRef.current[focused.id]?.openPopup();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [complaints, onSelectComplaint]);

  // Center on selected complaint when changed
  useEffect(() => {
    if (!selectedComplaintId || !mapInstanceRef.current) return;
    const selected = complaints.find((c) => c.id === selectedComplaintId);
    if (selected && typeof selected.latitude === 'number' && typeof selected.longitude === 'number') {
      mapInstanceRef.current.flyTo([selected.latitude, selected.longitude], STREET_ZOOM, {
        duration: 0.7,
      });
      const marker = markersRef.current[selected.id];
      if (marker && !marker.isPopupOpen()) {
        marker.openPopup();
      }
    }
  }, [selectedComplaintId, complaints]);

  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then((L) => {
      const validComplaints = complaints.filter(
        (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'
      );
      if (validComplaints.length > 0) {
        const bounds = L.latLngBounds(validComplaints.map((c) => [c.latitude, c.longitude]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: STREET_ZOOM });
      } else {
        mapInstanceRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
    });
  };

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="leaflet-map-canvas" />
      <button className="map-reset-btn" onClick={handleResetView} title="Center Pune City View">
        🧭 Reset View
      </button>
    </div>
  );
}
