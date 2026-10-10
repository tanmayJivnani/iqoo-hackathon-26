import { useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import type { CivicDomain } from '../data/civic';
import type { EvidenceLocation, NearbyComplaint } from '../features/complaints/types';
export function useEvidenceLocation(domain: CivicDomain) {
  const [location, setLocation] = useState<EvidenceLocation | null>(null);
  const [nearbyComplaints, setNearbyComplaints] = useState<NearbyComplaint[]>([]);
  const getLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Allow location access to attach the actual evidence location.');
      const recent = await Location.getLastKnownPositionAsync({ maxAge: 15_000, requiredAccuracy: 50 });
      let gpsTimeout: ReturnType<typeof setTimeout> | undefined;
      const current = recent || await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => { gpsTimeout = setTimeout(() => reject(new Error('GPS is taking too long. Move to an open location and retry.')), 15_000); }),
      ]).finally(() => clearTimeout(gpsTimeout));
      const address = `${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)}`;
      const evidenceLocation = { latitude: current.coords.latitude, longitude: current.coords.longitude, address, accuracy: current.coords.accuracy };
      setLocation(evidenceLocation);
      void Location.reverseGeocodeAsync(current.coords).then(result => {
        const first = result[0];
        if (first) setLocation(previous => previous?.latitude === evidenceLocation.latitude && previous.longitude === evidenceLocation.longitude ? { ...previous, address: [first.name, first.street, first.subregion, first.city].filter(Boolean).join(', ') || previous.address } : previous);
      }).catch(() => undefined);
      void api<{ nearby_complaints: NearbyComplaint[] }>('/api/v1/complaints/check-duplicate', {
        method: 'POST', body: JSON.stringify({ latitude: current.coords.latitude, longitude: current.coords.longitude, radius_meters: 30, domain }),
      }).then(duplicates => setNearbyComplaints(duplicates.nearby_complaints ?? [])).catch(() => setNearbyComplaints([]));
      return evidenceLocation;
    } catch (error) { Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Could not get a GPS fix. Please retry.'); return null; }
  };

  return { location, setLocation, nearbyComplaints, setNearbyComplaints, getLocation };
}
