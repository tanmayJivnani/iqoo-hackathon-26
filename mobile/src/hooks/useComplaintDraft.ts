import { useState, type Dispatch, type SetStateAction, type RefObject } from 'react';
import { Alert } from 'react-native';
import { File } from 'expo-file-system';
import { api, type Draft } from '../lib/api';
import { evaluateNoiseActionability, QUIET_RECORDING_MESSAGE, type NoiseEvidence } from '../lib/noise';
import type { CivicDomain } from '../data/civic';
import { photoBase64, type Page, type Photo, type Profile, type EvidenceLocation } from '../features/complaints/types';
import type { LocalAISettings } from './useLocalAI';
type Options = {
  aiSettings: LocalAISettings;
  domain: CivicDomain; category: string; location: EvidenceLocation | null; noiseEvidence: NoiseEvidence | null;
  setNoiseEvidence: Dispatch<SetStateAction<NoiseEvidence | null>>; photos: Photo[]; perpetratorPhotos: Photo[];
  capturedAt: string; profile: Profile; notes: string; perpetratorName: string; perpetratorPhone: string;
  refresh: () => Promise<void>; operationRef: RefObject<boolean>; setBusy: Dispatch<SetStateAction<boolean>>;
  setPage: Dispatch<SetStateAction<Page>>;
};
export function useComplaintDraft({ domain, category, location, noiseEvidence, setNoiseEvidence, photos,
  perpetratorPhotos, capturedAt, profile, notes, perpetratorName, perpetratorPhone,
  refresh, operationRef, setBusy, setPage, aiSettings }: Options) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const prepareFastDraft = async () => {
    if (operationRef.current) return;
    if (!location || (domain === 'NOISE' ? !noiseEvidence : !photos.length)) { Alert.alert('Evidence required', 'Capture evidence and GPS before preparing the notice.'); return; }
    if (domain === 'TREES' && photos.length !== 2) { Alert.alert('Two photos required', 'Take an overall view of the whole tree and location, followed by a close-up of the issue.'); return; }
    if (category === 'ROAD_POTHOLE' && photos.length !== 2) { Alert.alert('Two photos required', 'Take a close-up of the pothole, then a wider photo showing the surrounding road and a nearby landmark.'); return; }
    if (domain === 'NOISE' && noiseEvidence) {
      const hourStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date(noiseEvidence.captured_at));
      const isNight = Number(hourStr) >= 22 || Number(hourStr) < 6;
      const actionCheck = evaluateNoiseActionability(noiseEvidence, isNight, Boolean(noiseEvidence.near_sensitive_site));
      if (!actionCheck.actionable) {
        setNoiseEvidence(null);
        Alert.alert('Please re-record', actionCheck.reason || QUIET_RECORDING_MESSAGE);
        return;
      }
    }
    if (aiSettings.loading || aiSettings.importing) { Alert.alert('AI settings loading', 'Wait for model settings to finish loading.'); return; }
    operationRef.current = true; setBusy(true);
    try {
      const localText = aiSettings.mode === 'LOCAL_QWEN_35' ? await aiSettings.summarize({
        issue: category, address: location.address, citizen_observations: notes || 'No additional observations.',
      }, false, { imageUris: photos.map(photo => photo.uri) }) : undefined;
      const audioBase64 = noiseEvidence ? await new File(noiseEvidence.uri).base64() : undefined;
      const videoBase64 = noiseEvidence?.video_uri ? await new File(noiseEvidence.video_uri).base64() : undefined;
      const response = await api<Draft>('/api/v1/complaints/fast-draft', { method: 'POST', signal: AbortSignal.timeout(100_000), body: JSON.stringify({
        ai_mode: aiSettings.mode, local_text: localText, issue_type: category, latitude: location.latitude, longitude: location.longitude, gps_accuracy_m: location.accuracy,
        captured_at: noiseEvidence?.captured_at || capturedAt, photos_base64: photos.map(photoBase64), perpetrator_photos_base64: perpetratorPhotos.map(photoBase64),
        audio_base64: audioBase64, video_base64: videoBase64, noise_evidence: noiseEvidence || undefined,
        citizen_notes: notes || null, citizen_name: profile.name || null, citizen_phone: profile.phone || null, citizen_email: profile.email || null,
        address_landmark: location.address, perpetrator_name: perpetratorName || null, perpetrator_phone: perpetratorPhone || null,
      }) });
      setDraft(response); setPage('draft'); void refresh();
    } catch (error) { Alert.alert('Notice not prepared', error instanceof Error ? error.message : 'Reconnect to the local backend and retry. Your captured evidence is still available.'); }
    finally { operationRef.current = false; setBusy(false); }
  };

  return { draft, setDraft, prepareFastDraft };
}
