import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { CivicDomain } from '../data/civic';
import type { Photo, Page, EvidenceLocation } from '../features/complaints/types';
type Options = { domain: CivicDomain; category: string; location: EvidenceLocation | null;
  getLocation: () => Promise<EvidenceLocation | null>; setPage: Dispatch<SetStateAction<Page>> };
export function useEvidenceCapture({ domain, category, location, getLocation, setPage }: Options) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [perpetratorPhotos, setPerpetratorPhotos] = useState<Photo[]>([]);
  const [capturedAt, setCapturedAt] = useState('');
  const captureRef = useRef(false);
  const requiresTwoPhotos = domain === 'TREES' || category === 'ROAD_POTHOLE';
  const maxEvidencePhotos = requiresTwoPhotos ? 2 : 3;
  const captureNativePhoto = async (): Promise<Photo | null> => {
    if (captureRef.current) return null;
    captureRef.current = true;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to capture evidence.');
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], allowsEditing: false, quality: 1, base64: true,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      if (!asset?.uri || !asset.base64) throw new Error('The photo could not be read. Try again.');
      return { uri: asset.uri, base64: asset.base64 };
    } catch (error) {
      Alert.alert('Could not capture photo', error instanceof Error ? error.message : 'Try again.');
      return null;
    } finally { captureRef.current = false; }
  };

  const openCamera = async (replaceIndex: number | null = null) => {
    if (replaceIndex === null && photos.length >= maxEvidencePhotos) return;
    const photo = await captureNativePhoto();
    if (!photo) return;
    setCapturedAt(new Date().toISOString());
    setPhotos(current => replaceIndex === null ? [...current, photo].slice(0, maxEvidencePhotos)
      : current.map((existing, index) => index === replaceIndex ? photo : existing));
    setPage(requiresTwoPhotos && replaceIndex === null && photos.length === 0 ? 'capture' : 'review');
    if (!location) void getLocation();
  };

  const choosePhotos = async (replaceIndex: number | null = null) => {
    if (captureRef.current) return;
    const remaining = replaceIndex === null ? maxEvidencePhotos - photos.length : 1;
    if (remaining <= 0) { setPage('review'); return; }
    captureRef.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: !requiresTwoPhotos,
        selectionLimit: requiresTwoPhotos ? 1 : remaining, quality: 0.68, base64: true,
      });
      if (result.canceled) return;
      const chosen = result.assets.slice(0, requiresTwoPhotos ? 1 : remaining)
        .filter(asset => asset.base64).map(asset => ({ uri: asset.uri, base64: asset.base64! }));
      if (!chosen.length) { Alert.alert('Photo required', 'Please select a readable photo.'); return; }
      const nextPhotos = replaceIndex === null ? [...photos, ...chosen].slice(0, maxEvidencePhotos)
        : photos.map((photo, index) => index === replaceIndex ? chosen[0] : photo);
      setCapturedAt(new Date().toISOString()); setPhotos(nextPhotos);
      setPage(requiresTwoPhotos && nextPhotos.length < 2 ? 'capture' : 'review');
      if (!location) void getLocation();
    } catch (error) {
      Alert.alert('Could not select photo', error instanceof Error ? error.message : 'Please try again.');
    } finally { captureRef.current = false; }
  };

  const attachOffenderPhoto = async () => {
    if (perpetratorPhotos.length >= 3) { Alert.alert('Photo limit', 'You can attach up to three optional photos.'); return; }
    const photo = await captureNativePhoto();
    if (photo) setPerpetratorPhotos(previous => [...previous, photo].slice(0, 3));
  };

  return { photos, setPhotos, perpetratorPhotos, setPerpetratorPhotos, capturedAt, setCapturedAt,
    maxEvidencePhotos, captureNativePhoto, openCamera, choosePhotos, attachOffenderPhoto };
}
