import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MailComposer from 'expo-mail-composer';
import * as SecureStore from 'expo-secure-store';
import { Accelerometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Image, Keyboard, KeyboardAvoidingView, Linking, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocalTreeAI from '../../modules/local-tree-ai/src/LocalTreeAIModule';
import { apiDate, canUseLocalAnalysis, isResolved, isTimelocked, nextPhotoRejection } from '../lib/complaint-flow';
import { categoriesByDomain, allCategories, tabs, domainFor, categoryLabel, legalGrounding, type CivicDomain } from '../data/civic';
import { NoiseCapture } from '../components/NoiseCapture';
import { ProfileSheet } from '../components/ProfileSheet';
import type { NoiseEvidence } from '../lib/noise';
import { API_BASE, api, asDataUri, type Complaint, type ComplaintDetail, type Draft } from '../lib/api';

type Page = 'tracker' | 'category' | 'guidance' | 'camera' | 'review' | 'noise' | 'draft' | 'dispatch' | 'verify';
type Profile = { name: string; phone: string; email: string };
type Photo = { uri: string; base64: string };
type EvidenceLocation = { latitude: number; longitude: number; address: string; accuracy?: number | null };
type LocalAnalysis = { available: boolean; treeDetected: boolean; visualDamageSummary?: string | null; estimatedTreeSpecies?: string | null; urgencyLevel?: string | null };
const blankProfile: Profile = { name: '', phone: '', email: '' };
const green = '#246B45';
const dark = '#19392A';

function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}>
    <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
  </Pressable>;
}
function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad'; multiline?: boolean;
}) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><TextInput
    value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType}
    autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} multiline={multiline}
    textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.inputMultiline]}
  /></View>;
}
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
function PageHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return <View style={styles.pageHeader}>{onBack ? <Pressable onPress={onBack} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable> : null}
    <View style={{ flex: 1 }}><Text style={styles.pageTitle}>{title}</Text>{subtitle ? <Text style={styles.subtle}>{subtitle}</Text> : null}</View>
  </View>;
}
function photoBase64(photo: Photo) { return photo.base64.replace(/^data:image\/[^;]+;base64,/, ''); }

function localDraft(category: string, latitude: number, longitude: number, address: string, profile: Profile, analysis: LocalAnalysis): Draft {
  const tracking = `PUNE-TREE-LOC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const citations = legalGrounding[category] ?? legalGrounding.HAZARDOUS_BRANCH;
  const categoryName = categoryLabel(category);
  return {
    complaint_id: '', tracking_id: tracking, issue_type: category, urgency_level: analysis?.urgencyLevel ?? 'HIGH',
    felling_stage: 'NOT_APPLICABLE', is_cognizable_offence: category === 'ILLEGAL_FELLING',
    estimated_tree_species: analysis?.estimatedTreeSpecies ?? undefined,
    visual_damage_summary: analysis?.visualDamageSummary ?? 'Evidence saved for local review. Add any observations before dispatch.',
    citizen_name: profile.name || 'Concerned Pune Citizen', citizen_phone: profile.phone || undefined,
    citizen_email: profile.email || undefined, latitude, longitude, address_landmark: address,
    ward_name: 'Pune', routed_authority: null,
    legal_citations: citations, draft_subject_en: `Tree grievance: ${categoryName} — ${tracking}`,
    draft_body_en: `To the Tree Officer, Pune Municipal Corporation,\n\nI am reporting a ${categoryName.toLowerCase()} at ${address || 'Pune'} (latitude ${latitude.toFixed(5)}, longitude ${longitude.toFixed(5)}).\n\n${analysis?.visualDamageSummary ?? 'Please inspect the attached photo evidence and take appropriate action.'}\n\nGrounding: ${citations.join('; ')}.\n\nPlease acknowledge this complaint and share the action taken.\n\nSincerely,\n${profile.name || 'Concerned Pune Citizen'}${profile.phone ? `\n${profile.phone}` : ''}`,
    draft_summary_mr: `पुणे येथे ${categoryName} संदर्भात तक्रार नोंदवली आहे. कृपया जोडलेल्या छायाचित्रांची पाहणी करून योग्य ती कार्यवाही करावी.`,
    reverification_due_hours: 48, is_fallback: true, ai_provider: 'ON_DEVICE_GEMMA',
  };
}

export default function HomeScreen() {
  const [page, setPage] = useState<Page>('tracker');
  const [domain, setDomain] = useState<CivicDomain>('TREES');
  const [photoTarget, setPhotoTarget] = useState(1);
  const [capturedAt, setCapturedAt] = useState('');
  const [noiseEvidence, setNoiseEvidence] = useState<NoiseEvidence | null>(null);
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Profile>(blankProfile);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [nearbyComplaints, setNearbyComplaints] = useState<{ id: string; tracking_id: string; issue_type: string; distance_meters: number; witness_count: number; address_landmark: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelInstalled, setModelInstalled] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const [perpetratorPhotos, setPerpetratorPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState('');
  const [perpetratorName, setPerpetratorName] = useState('');
  const [perpetratorPhone, setPerpetratorPhone] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [location, setLocation] = useState<EvidenceLocation | null>(null);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const operationRef = useRef(false);
  const captureRef = useRef(false);
  const [tilt, setTilt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingProfileStart, setPendingProfileStart] = useState(false);
  const closeProfile = useCallback(() => {
    Keyboard.dismiss(); setPendingProfileStart(false); setProfileOpen(false);
  }, []);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [verificationPhoto, setVerificationPhoto] = useState<Photo | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ ai_verdict: string; ai_confidence: number; ai_notes_en: string; ai_notes_mr: string; final_status: string; gps_valid: boolean; distance_from_original_m: number; reopen_count: number } | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const category = selectedCategories[0] ?? 'DANGEROUS_LEANING_FALL_RISK';
  const categories = categoriesByDomain[domain];
  const visibleComplaints = complaints.filter(item => (item.domain || domainFor(item.issue_type)) === domain);

  const refresh = async () => {
    setLoading(true);
    try { setComplaints(await api<Complaint[]>('/api/v1/complaints/')); setTrackerError(null); }
    catch (error) { setTrackerError(error instanceof Error ? error.message : 'Could not load reports. Pull to retry.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync('citizen-profile');
        if (saved) setProfile(JSON.parse(saved));
      } catch { /* profile can be re-entered */ }
      try { setModelInstalled(LocalTreeAI.getModelStatus().installed); } catch { setModelInstalled(false); }
      void refresh();
    })();
  }, []);

  useEffect(() => {
    if (page !== 'camera') return;
    Accelerometer.setUpdateInterval(500);
    const subscription = Accelerometer.addListener(({ x, z }) => setTilt(Math.atan2(x, z) * 180 / Math.PI));
    return () => subscription.remove();
  }, [page]);

  useEffect(() => {
    if (page === 'tracker') return;
    const backTargets: Record<Page, Page> = {
      tracker: 'tracker', category: 'tracker', guidance: 'category', noise: 'category', camera: retakeIndex !== null ? 'review' : 'guidance',
      review: 'guidance', draft: detail ? 'tracker' : domain === 'NOISE' ? 'noise' : 'review', dispatch: 'draft', verify: detail ? 'draft' : 'tracker',
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'camera' && retakeIndex !== null) setRetakeIndex(null);
      if (page === 'draft' && detail) setDetail(null);
      setPage(backTargets[page]);
      return true;
    });
    return () => subscription.remove();
  }, [page, retakeIndex, detail, domain]);

  const saveProfile = async () => {
    if (!profileDraft.name.trim() || !profileDraft.phone.trim()) {
      Alert.alert('A little more information', 'Please enter your name and phone number to continue.'); return;
    }
    try { await SecureStore.setItemAsync('citizen-profile', JSON.stringify(profileDraft)); }
    catch { Alert.alert('Profile not saved', 'Could not save your profile securely. Please retry.'); return; }
    setProfile(profileDraft);
    setProfileOpen(false);
    if (pendingProfileStart) { setPendingProfileStart(false); setPage('category'); }
  };

  const startComplaint = () => {
    setPhotoTarget(1); setNoiseEvidence(null); setCapturedAt('');
    setSelectedCategories([]); setPhotos([]); setRetakeIndex(null); setNearbyComplaints([]); setNotes(''); setDraft(null); setDetail(null);
    setPerpetratorName(''); setPerpetratorPhone(''); setPerpetratorPhotos([]); setLocation(null); setTilt(0);
    setVerificationPhoto(null); setVerificationResult(null); setVerificationNote('');
    setPage('category');
  };

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
      void api<{ nearby_complaints: typeof nearbyComplaints }>('/api/v1/complaints/check-duplicate', {
        method: 'POST', body: JSON.stringify({ latitude: current.coords.latitude, longitude: current.coords.longitude, radius_meters: 30, domain }),
      }).then(duplicates => setNearbyComplaints(duplicates.nearby_complaints ?? [])).catch(() => setNearbyComplaints([]));
      return evidenceLocation;
    } catch (error) { Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Could not get a GPS fix. Please retry.'); return null; }
  };

  const openCamera = async (replaceIndex: number | null = null) => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) { Alert.alert('Camera access needed', 'Allow camera access to capture evidence.'); return; }
    }
    setRetakeIndex(replaceIndex);
    if (replaceIndex === null && photos.length === 0 && !await getLocation()) return;
    setPage('camera');
  };

  const takePhoto = async () => {
    if (!cameraRef.current || captureRef.current) return;
    captureRef.current = true;
    try {
      const image = await cameraRef.current.takePictureAsync({ quality: 0.68, base64: true });
      if (!image?.uri || !image.base64) throw new Error('The photo could not be read. Try again.');
      const newPhoto = { uri: image.uri, base64: image.base64 };
      setCapturedAt(new Date().toISOString());
      if (retakeIndex !== null) {
        setPhotos((current) => current.map((photo, index) => index === retakeIndex ? newPhoto : photo));
        setRetakeIndex(null);
        setPage('review');
      } else {
        const next = [...photos, newPhoto];
        setPhotos(next);
        if (next.length >= photoTarget) setPage('review');
      }
    } catch (error) { Alert.alert('Could not capture photo', error instanceof Error ? error.message : 'Try again.'); }
    finally { captureRef.current = false; }
  };

  const choosePhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 0.68, base64: true });
    if (result.canceled) return;
    const chosen = result.assets.slice(0, 3).filter((asset) => asset.base64).map((asset) => ({ uri: asset.uri, base64: asset.base64! }));
    if (!chosen.length) { Alert.alert('Photo required', 'Please select at least one readable photo.'); return; }
    if (!await getLocation()) return;
    setCapturedAt(new Date().toISOString()); setPhotos(chosen); setRetakeIndex(null); setPage('review');
  };

  const attachOffenderPhoto = async () => {
    if (perpetratorPhotos.length >= 3) { Alert.alert('Photo limit', 'You can attach up to three optional photos.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.68, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) setPerpetratorPhotos((previous) => [...previous, { uri: asset.uri, base64: asset.base64! }]);
  };

  const analyze = async () => {
    if (operationRef.current) return;
    if (!location) { Alert.alert('Location required', 'Capture the actual GPS position before analyzing evidence.'); return; }
    if (photos.length !== 3) { Alert.alert('Three photos required', 'Capture or select all three guided evidence photos.'); return; }
    operationRef.current = true;
    setBusy(true);
    try {
      const storedGuard = await SecureStore.getItemAsync('tree-photo-guard');
      const guard: { count: number; cooldownUntil: number } = storedGuard ? JSON.parse(storedGuard) : { count: 0, cooldownUntil: 0 };
      if (guard.cooldownUntil > Date.now()) {
        const minutes = Math.ceil((guard.cooldownUntil - Date.now()) / 60000);
        Alert.alert('Photo review paused', `Three photos without a tree were submitted. Please wait ${Math.ceil(minutes / 60)} hour(s) before trying again.`); return;
      }
      const recordRejectedPhoto = async () => {
        const next = nextPhotoRejection(guard);
        await SecureStore.setItemAsync('tree-photo-guard', JSON.stringify(next));
        if (next.cooldownUntil) Alert.alert('Anti-spam pause', 'Three photo checks did not show a tree. Photo analysis is paused for three hours.');
      };
      let local: LocalAnalysis | undefined;
      if (modelInstalled) {
        try {
          const result = await LocalTreeAI.analyzePhoto(photos[0].uri, category, location.address);
          if (result.available && !result.treeDetected) {
            await recordRejectedPhoto();
            Alert.alert('No tree detected', result.rejectionReason || 'Point the camera at a real tree and try again.'); setBusy(false); return;
          }
          if (result.available && result.treeDetected) local = result;
        } catch {
          Alert.alert('Local model unavailable', 'The local model could not analyze this photo. I’ll try the server analysis instead.');
        }
      }
      const payload = {
        photo_base64: photoBase64(photos[0]), photos_base64: photos.map(photoBase64),
        perpetrator_photos_base64: perpetratorPhotos.map(photoBase64), citizen_selected_category: selectedCategories.join(','),
        latitude: location.latitude, longitude: location.longitude, sensor_tilt_angle: null,
        citizen_notes: [notes, ...selectedCategories.slice(1).map(categoryLabel)].filter(Boolean).join('\nAdditional selected issue: '),
        citizen_name: profile.name, citizen_phone: profile.phone, citizen_email: profile.email || null,
        perpetrator_name: perpetratorName || null, perpetrator_phone: perpetratorPhone || null, address_landmark: location.address,
      };
      try {
        const response = await api<Draft>('/api/v1/complaints/analyze-and-draft', { method: 'POST', body: JSON.stringify(payload) });
        if (!response.tree_detected) { await recordRejectedPhoto(); Alert.alert('Photo check', response.rejection_reason || 'The photos need a visible tree.'); return; }
        await SecureStore.deleteItemAsync('tree-photo-guard');
        setDraft(response);
      } catch (networkError) {
        if (!local || !canUseLocalAnalysis(local)) throw networkError;
        await SecureStore.deleteItemAsync('tree-photo-guard');
        setDraft({ ...localDraft(category, location.latitude, location.longitude, location.address, profile, local), perpetrator_name: perpetratorName || null, perpetrator_phone: perpetratorPhone || null });
        Alert.alert('Saved for local review', 'The server could not be reached. The on-device model prepared a draft; reconnect to save the report and generate its PDF.');
      }
      setPage('draft');
    } catch (error) { Alert.alert('Analysis failed', error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { operationRef.current = false; setBusy(false); }
  };

  const prepareFastDraft = async () => {
    if (operationRef.current) return;
    if (!location || (domain === 'NOISE' ? !noiseEvidence : !photos.length)) { Alert.alert('Evidence required', 'Capture evidence and GPS before preparing the notice.'); return; }
    operationRef.current = true; setBusy(true);
    try {
      const audioBase64 = noiseEvidence ? await new File(noiseEvidence.uri).base64() : undefined;
      const response = await api<Draft>('/api/v1/complaints/fast-draft', { method: 'POST', signal: AbortSignal.timeout(20_000), body: JSON.stringify({
        issue_type: category, latitude: location.latitude, longitude: location.longitude, gps_accuracy_m: location.accuracy,
        captured_at: noiseEvidence?.captured_at || capturedAt, photos_base64: [...photos, ...perpetratorPhotos].map(photoBase64),
        audio_base64: audioBase64, noise_evidence: noiseEvidence || undefined,
        citizen_notes: notes || null, citizen_name: profile.name || null, citizen_phone: profile.phone || null, citizen_email: profile.email || null,
        address_landmark: location.address, perpetrator_name: perpetratorName || null, perpetrator_phone: perpetratorPhone || null,
      }) });
      setDraft(response); setPage('draft'); void refresh();
    } catch (error) { Alert.alert('Notice not prepared', error instanceof Error ? error.message : 'Reconnect to the local backend and retry. Your captured evidence is still available.'); }
    finally { operationRef.current = false; setBusy(false); }
  };

  const importGemma = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/octet-stream', 'application/*', '*/*'], copyToCacheDirectory: true });
      if (picked.canceled) return;
      const uri = picked.assets[0]?.uri;
      if (!uri) return;
      setBusy(true);
      await LocalTreeAI.importModelFromUri(uri);
      const installed = LocalTreeAI.getModelStatus().installed;
      if (!installed) throw new Error('The selected model could not be saved.');
      setModelInstalled(installed);
      Alert.alert('On-device AI ready', 'Gemma has been imported to app storage.');
    } catch (error) { Alert.alert('Model import failed', error instanceof Error ? error.message : 'Choose a compatible MediaPipe Gemma .task model.'); }
    finally { setBusy(false); }
  };

  const openDetail = async (id: string) => {
    setBusy(true);
    try { setDetail(await api<ComplaintDetail>(`/api/v1/complaints/${id}`)); setPage('draft'); }
    catch (error) { Alert.alert('Could not open complaint', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const sendDispatch = async (channel: 'EMAIL' | 'WHATSAPP') => {
    if (!draft || operationRef.current) return;
    operationRef.current = true;
    setBusy(true);
    try {
      if (channel === 'EMAIL' && !(await MailComposer.isAvailableAsync())) {
        throw new Error('Set up an email app on this phone before sharing the report by email.');
      }
      const complaintId = draft.complaint_id || `loc-${draft.tracking_id}`;
      const pdf = await api<{ complaint_id: string; pdf_url: string }>('/api/v1/complaints/render-pdf', {
        method: 'POST', body: JSON.stringify({
          ...draft, complaint_id: complaintId,
          photo_base64: photos[0] ? photoBase64(photos[0]) : undefined,
          photos_base64: [...photos, ...perpetratorPhotos].map(photoBase64),
        }),
      });
      // Keep the registered ID for retrying a failed dispatch without creating another report.
      setDraft({ ...draft, complaint_id: pdf.complaint_id });
      const result = await api<{ email?: { ready: boolean; recipient: string; subject: string; body: string; attachment_url: string; audio_attachment_url?: string | null }; whatsapp?: { deep_link_url: string } }>(
        '/api/v1/complaints/dispatch', { method: 'POST', body: JSON.stringify({
          complaint_id: pdf.complaint_id, confirmed_by_citizen: true, channels: [channel],
        }) },
      );
      if (channel === 'EMAIL') {
        if (!result.email?.ready) throw new Error('The email could not be prepared. Your report is saved; please retry.');
        const attachment = await File.downloadFileAsync(
          `${API_BASE}${result.email.attachment_url}`,
          new File(Paths.cache, `${draft.tracking_id}.pdf`),
          { idempotent: true, signal: AbortSignal.timeout(60_000) },
        );
        const audioAttachment = result.email.audio_attachment_url ? await File.downloadFileAsync(`${API_BASE}${result.email.audio_attachment_url}`, new File(Paths.cache, `${draft.tracking_id}.m4a`), { idempotent: true, signal: AbortSignal.timeout(30_000) }) : null;
        await MailComposer.composeAsync({
          recipients: [result.email.recipient], subject: result.email.subject,
          body: result.email.body, attachments: [attachment.uri, ...(audioAttachment ? [audioAttachment.uri] : [])],
        });
      } else {
        if (!result.whatsapp?.deep_link_url) throw new Error('The WhatsApp summary could not be prepared.');
        await Linking.openURL(result.whatsapp.deep_link_url);
      }
      // Android reports the composer as "sent" even when delivery is unknown.
      // Keep this screen available to retry or share through the other channel.
      await refresh();
    } catch (error) {
      Alert.alert('Dispatch incomplete', error instanceof Error ? error.message : 'Your draft is still available. Try again when connected.');
    } finally { operationRef.current = false; setBusy(false); }
  };

  const pickVerificationPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.68, base64: true });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) setVerificationPhoto({ uri: asset.uri, base64: asset.base64 });
  };
  const submitVerification = async () => {
    if (isTimelocked(detail?.verification_status, detail?.reverification_due_at)) { Alert.alert('Re-audit locked', 'Please wait until the follow-up deadline shown on the tracker.'); return; }
    if (!detail || !verificationPhoto) { Alert.alert('Photo required', 'Take a new on-site photo before running the check.'); return; }
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location access is required for an on-site re-audit.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const result = await api<{ ai_verdict: string; ai_confidence: number; ai_notes_en: string; ai_notes_mr: string; final_status: string; gps_valid: boolean; distance_from_original_m: number; reopen_count: number }>(`/api/v1/complaints/${detail.id}/verify`, { method: 'POST', body: JSON.stringify({
        complaint_id: detail.id, photo_base64: photoBase64(verificationPhoto),
        latitude: current.coords.latitude, longitude: current.coords.longitude,
        citizen_notes: verificationNote || null,
      }) });
      setVerificationResult(result);
      Alert.alert('Review complete', result.ai_verdict.replaceAll('_', ' '));
      await refresh();
    } catch (error) { Alert.alert('Verification failed', error instanceof Error ? error.message : 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  const upvoteNearby = async (id: string) => {
    try {
      const result = await api<{ status: string; new_witness_count: number; message: string }>('/api/v1/complaints/upvote-witness', { method: 'POST', body: JSON.stringify({ complaint_id: id, witness_name: profile.name, witness_phone: profile.phone }) });
      setNearbyComplaints((current) => current.map((item) => item.id === id ? { ...item, witness_count: result.new_witness_count } : item));
      Alert.alert(result.status === 'ALREADY_WITNESSED' ? 'Already a witness' : 'Added as witness', result.message);
    } catch (error) { Alert.alert('Could not add witness', error instanceof Error ? error.message : 'Please try again.'); }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {page === 'tracker' && <>
        <View style={styles.homeHeader}>
          <View style={styles.brandMark}><Text style={{ fontSize: 22 }}>🌳</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.brand}>Pune Fast Complaint</Text><Text style={styles.subtle}>{tabs.find(tab => tab.key === domain)?.caption}</Text></View>
          <Pressable onPress={() => { setPendingProfileStart(false); setProfileDraft(profile); setProfileOpen(true); }} style={styles.avatar}><Text style={styles.avatarText}>{profile.name ? profile.name[0].toUpperCase() : '👤'}</Text></Pressable>
          <Pressable onPress={() => void refresh()} style={styles.refresh}><Text style={{ color: green, fontSize: 22 }}>⟳</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={green} />}>
          <View style={styles.hero}><Text style={styles.eyebrow}>PUNE • {domain}</Text><Text style={styles.heroTitle}>Capture it.{ '\n' }Make it count.</Text><Text style={styles.heroCopy}>{domain === 'NOISE' ? 'A short audio sample, GPS and a ready-to-send police complaint.' : 'One photo, GPS and a ready-to-send civic notice. No legal writing required.'}</Text>
            <Button title="＋  Report a concern" onPress={startComplaint} /></View>
          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Your reports</Text><Text style={styles.count}>{visibleComplaints.length} {visibleComplaints.length === 1 ? 'report' : 'reports'}</Text></View>
          {trackerError && <Card style={styles.warningCard}><Text style={styles.warningTitle}>Reports unavailable</Text><Text style={styles.bodyText}>{trackerError}</Text><Button title="Retry" onPress={() => void refresh()} secondary /></Card>}
          {loading && !visibleComplaints.length ? <ActivityIndicator color={green} style={{ marginTop: 30 }} /> : !visibleComplaints.length && !trackerError ? <Card style={styles.emptyCard}><Text style={styles.emptyIcon}>{tabs.find(tab => tab.key === domain)?.emoji}</Text><Text style={styles.cardTitle}>No reports yet</Text><Text style={styles.subtleCenter}>Reports in this tab will appear here with their status.</Text><Button title="Start your first report" onPress={startComplaint} secondary /></Card> : visibleComplaints.map((item) => <Pressable key={item.id} onPress={() => void openDetail(item.id)}><Card style={styles.reportCard}>
            <View style={styles.reportTop}><Text style={styles.reportIcon}>{allCategories.find((c) => item.issue_type.includes(c.key))?.emoji ?? '🌿'}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{categoryLabel(item.issue_type)}</Text><Text style={styles.reportMeta}>{item.tracking_id} · {apiDate(item.created_at).toLocaleDateString()}</Text></View><Text style={styles.chevron}>›</Text></View>
            <Text style={styles.reportAddress}>📍 {item.address_landmark}</Text><View style={styles.reportBottom}><Text style={[styles.statusPill, isResolved(item.verification_status) ? styles.statusGreen : styles.statusAmber]}>{item.verification_status.replaceAll('_', ' ')}</Text><Text style={styles.reportMeta}>Urgency: {item.urgency_level.replaceAll('_', ' ')}</Text></View>
            {item.reverification_due_at && <Text style={styles.reportMeta}>Ground check due {apiDate(item.reverification_due_at).toLocaleString()}</Text>}
          </Card></Pressable>)}
          {domain === 'TREES' && <Card style={styles.aiCard}><View style={styles.aiRow}><Text style={{ fontSize: 24 }}>🤖</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Optional tree AI review</Text><Text style={styles.subtle}>{modelInstalled ? 'Model ready · Photo checks run on this phone' : 'Import a MediaPipe Gemma model for tree photo checks'}</Text></View></View><Button title={modelInstalled ? 'Replace local AI model' : 'Import local AI model'} onPress={() => void importGemma()} secondary disabled={busy} /></Card>}
          <Text style={styles.footer}>Capture · Review · Send from your email app</Text>
        </ScrollView>
      </>}

      {page === 'category' && <>
        <PageHeader title={`Report ${tabs.find(tab => tab.key === domain)?.title.toLowerCase()}`} subtitle="Choose the issue you observed" onBack={() => setPage('tracker')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.noteCard}><Text style={styles.noteText}>Choose one concern. The app prepares the recipient, legal references and notice text for you.</Text></Card>
          {categories.map((item) => {
            const selected = selectedCategories.includes(item.key);
            return <Pressable key={item.key} onPress={() => setSelectedCategories([item.key])}>
              <Card style={[styles.categoryCard, selected && styles.categorySelected]}><View style={styles.categoryTop}><Text style={styles.categoryEmoji}>{item.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.categoryDesc}>{item.description}</Text></View><Text style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? '✓' : ''}</Text></View></Card>
            </Pressable>;
          })}
          <Card style={styles.legalCard}><Text style={styles.legalTitle}>⚖️  Legal references</Text><Text style={styles.subtle}>{(legalGrounding[selectedCategories[0] || categories[0].key] || []).join('\n')}</Text></Card>
          <Button title={domain === 'NOISE' ? 'Continue to audio capture →' : 'Continue to camera →'} onPress={() => { if (!selectedCategories.length) setSelectedCategories([categories[0].key]); setPage(domain === 'NOISE' ? 'noise' : 'guidance'); }} />
        </ScrollView>
      </>}

      {page === 'guidance' && <>
        <PageHeader title="Capture evidence" subtitle="One clear photo is enough to prepare a notice" onBack={() => setPage('category')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>ISSUE SELECTED</Text><Text style={styles.locationTitle}>{categoryLabel(category)}</Text><Text style={styles.subtle}>Capture the concern and a nearby landmark from a safe place.</Text></Card>
          {(categories.find((item) => item.key === category)?.guides ?? categories[0].guides).slice(0, 1).map((guide, index) => <Card key={guide.badge} style={styles.guideCard}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.guideBadge}>{guide.badge.toUpperCase()}</Text><Text style={styles.cardTitle}>{guide.title}</Text><Text style={styles.categoryDesc}>{guide.instruction}</Text></View></Card>)}
          <Card style={styles.infoCard}><Text style={styles.infoTitle}>📍  Location is attached</Text><Text style={styles.subtle}>Allow foreground location access so your report includes GPS coordinates and a nearby address.</Text></Card>
          <Button title="Open camera" onPress={() => void openCamera()} />
          <Button title="Choose existing photos" onPress={() => void choosePhotos()} secondary />
        </ScrollView>
      </>}

      {page === 'camera' && <View style={styles.cameraPage}>
        <PageHeader title={`Photo ${(retakeIndex ?? photos.length) + 1} of ${photoTarget}`} subtitle={categoryLabel(category)} onBack={() => { if (retakeIndex !== null) { setRetakeIndex(null); setPage('review'); } else setPage('guidance'); }} />
        <View style={styles.cameraFrame}>{cameraPermission?.granted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" /> : <View style={styles.cameraFallback}><Text style={styles.emptyIcon}>📷</Text><Text style={styles.cardTitle}>Camera permission is required</Text></View>}
          <View style={styles.cameraOverlay}><Text style={styles.cameraTip}>{(categories.find((item) => item.key === category)?.guides ?? categories[0].guides)[photos.length]?.instruction}</Text><Text style={styles.tilt}>Device tilt {Math.abs(tilt).toFixed(0)}°</Text></View>
        </View>
        <View style={styles.cameraFooter}><View style={styles.photoDots}>{Array.from({ length: photoTarget }, (_, index) => <View key={index} style={[styles.dot, index < photos.length && styles.dotDone, index === (retakeIndex ?? photos.length) && styles.dotCurrent]} />)}</View><Button title={retakeIndex === null ? '●  Capture evidence' : '●  Retake this photo'} onPress={() => void takePhoto()} /><Button title="Choose from gallery" onPress={() => void choosePhotos()} secondary /></View>
      </View>}

      {page === 'review' && <>
        <PageHeader title="Review evidence" subtitle="Step 3 of 5 · Check your photos and add context" onBack={() => setPage('guidance')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>📍 GPS LOCATION</Text><Text style={styles.locationTitle}>{location?.address ?? 'GPS position required'}</Text><Text style={styles.subtle}>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Acquire GPS before continuing'}</Text></Card>
          <View style={styles.photoGrid}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photoItem}><Image source={{ uri: photo.uri }} style={styles.photoThumb} /><Text style={styles.photoCaption}>{index + 1}. {(categories.find((item) => item.key === category)?.guides ?? categories[0].guides)[index]?.badge}</Text><Pressable onPress={() => void openCamera(index)}><Text style={styles.removeText}>Retake</Text></Pressable></View>)}</View>
          {nearbyComplaints.length > 0 && <Card style={styles.warningCard}><Text style={styles.warningTitle}>📍  Nearby reports within 30 m</Text><Text style={styles.subtle}>A similar open report may already cover this location. Add your name as a witness or continue with your own evidence.</Text>{nearbyComplaints.map((item) => <View key={item.id} style={styles.duplicateRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{categoryLabel(item.issue_type)}</Text><Text style={styles.reportMeta}>{item.tracking_id} · {item.distance_meters.toFixed(0)} m · {item.witness_count} witnesses</Text></View><Pressable onPress={() => void upvoteNearby(item.id)}><Text style={styles.witnessButton}>+ Witness</Text></Pressable></View>)}</Card>}
          <Field label="Your observations (optional)" value={notes} onChangeText={setNotes} placeholder="Describe the visible damage or immediate danger…" multiline />
          <Card style={styles.optionalCard}><View style={styles.aiRow}><Text style={{ fontSize: 21 }}>👷</Text><View><Text style={styles.cardTitle}>Offender or equipment evidence</Text><Text style={styles.subtle}>Optional · Do not approach unsafe activity</Text></View></View>
            <Field label="Person or contractor (optional)" value={perpetratorName} onChangeText={setPerpetratorName} placeholder="Name or identifying details" />
            <Field label="Phone or vehicle registration (optional)" value={perpetratorPhone} onChangeText={setPerpetratorPhone} placeholder="Phone / vehicle number" />
            <Button title={`＋  Add evidence photo (${perpetratorPhotos.length}/3)`} onPress={() => void attachOffenderPhoto()} secondary />
          </Card>
          <Card style={styles.noteCard}><Text style={styles.noteText}>A notice is generated from your selected issue and evidence. It requests authority inspection; it does not certify a violation.</Text></Card>
          <Button title={busy ? 'Preparing notice…' : 'Prepare notice →'} onPress={() => void prepareFastDraft()} disabled={busy || !photos.length} />
          {domain === 'TREES' && (photos.length < 3 ? <Button title={`Add ${3 - photos.length} context photo(s) for optional AI review`} onPress={() => { setPhotoTarget(3); void openCamera(); }} disabled={busy} secondary /> : <Button title={busy ? 'Analyzing…' : 'Optional AI tree review'} onPress={() => void analyze()} disabled={busy} secondary />)}
          {busy && <ActivityIndicator color={green} />}
        </ScrollView>
      </>}

      {page === 'draft' && (detail ? <>
        <PageHeader title="Complaint details" subtitle={detail.tracking_id} onBack={() => { setDetail(null); setPage('tracker'); }} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card><Text style={styles.locationLabel}>ISSUE</Text><Text style={styles.cardTitle}>{categoryLabel(detail.issue_type)}</Text><Text style={styles.subtle}>📍 {detail.address_landmark}</Text><Text style={styles.reportMeta}>Status: {(detail.verification_status ?? 'PENDING_TIMELOCK').replaceAll('_', ' ')}</Text></Card>
          <Card><Text style={styles.legalTitle}>Routed authority</Text><Text style={styles.cardTitle}>{typeof detail.routed_authority === 'string' ? detail.routed_authority : detail.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{detail.target_email ?? (typeof detail.routed_authority === 'object' ? detail.routed_authority?.email : '')}</Text></Card>
          <Card><Text style={styles.legalTitle}>Formal grievance</Text><Text style={styles.cardTitle}>{detail.draft_subject_en}</Text><Text style={styles.bodyText}>{detail.draft_body_en}</Text></Card>
          {detail.pdf_path && <Button title="Open statutory PDF" onPress={() => void Linking.openURL(`${API_BASE}/api/v1/complaints/${encodeURIComponent(detail.id)}/download-pdf`)} secondary />}
          <Card><Text style={styles.legalTitle}>तक्रार गोषवारा</Text><Text style={styles.bodyText}>{detail.draft_summary_mr}</Text></Card>
          {detail.reverification_required !== false && <Button disabled={isTimelocked(detail.verification_status, detail.reverification_due_at)} title={isTimelocked(detail.verification_status, detail.reverification_due_at) ? "Photo check available after the reminder" : "📸  Submit ground re-audit"} onPress={() => { setVerificationPhoto(null); setVerificationResult(null); setVerificationNote(''); setPage('verify'); }} />}
          {detail.audio_url && <Button title="Open audio evidence" onPress={() => void Linking.openURL(`${API_BASE}${detail.audio_url}`)} secondary />}
          <Button title="Back to tracker" onPress={() => { setDetail(null); setPage('tracker'); }} secondary />
        </ScrollView>
      </> : draft ? <>
        <PageHeader title="Review your notice" subtitle="Check the recipient and statement before sharing" onBack={() => setPage(domain === 'NOISE' ? 'noise' : 'review')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.trackingBanner}><Text style={styles.locationLabel}>TRACKING NUMBER</Text><Text style={styles.trackingId}>{draft.tracking_id}</Text><Text style={styles.subtle}>{draft.ai_provider === 'FAST_TEMPLATE' ? 'Prepared from your evidence and observations' : draft.ai_provider ? `Prepared with ${draft.ai_provider.replaceAll('_', ' ')}` : 'AI-assisted draft'}{draft.is_fallback ? ' · Offline draft' : ''}</Text></View>
          {!draft.complaint_id && <Card style={styles.warningCard}><Text style={styles.warningTitle}>⚠️ Local draft</Text><Text style={styles.subtle}>This draft is not yet saved on the server. Connect to the internet before expecting a server tracking record or PDF.</Text></Card>}
          {draft.is_category_mismatch && <Card style={styles.infoCard}><Text style={styles.legalTitle}>AI issue suggestion</Text><Text style={styles.cardTitle}>{categoryLabel(draft.ai_suggested_category ?? undefined)}</Text><Text style={styles.subtle}>{draft.mismatch_reason_en}</Text></Card>}
          {draft.ai_additional_category && <Card style={styles.infoCard}><Text style={styles.legalTitle}>Additional issue noticed</Text><Text style={styles.subtle}>{categoryLabel(draft.ai_additional_category)} · {draft.ai_additional_reason_en}</Text></Card>}
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>{draft.ai_provider === 'FAST_TEMPLATE' ? 'REPORTED ISSUE' : 'ANALYSIS'}</Text><Text style={styles.cardTitle}>{categoryLabel(draft.issue_type)}</Text><Text style={styles.subtle}>Urgency: {draft.urgency_level.replaceAll('_', ' ')}{draft.estimated_tree_species ? `  ·  ${draft.estimated_tree_species}` : ''}</Text><Text style={styles.bodyText}>{draft.visual_damage_summary}</Text></Card>
          <Card><Text style={styles.legalTitle}>📍  Location and statutory route</Text><Text style={styles.cardTitle}>{draft.address_landmark}</Text><Text style={styles.subtle}>{draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)} · {draft.ward_name}</Text><View style={styles.divider} /><Text style={styles.cardTitle}>{draft.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{draft.routed_authority?.role}</Text><Text style={styles.reportMeta}>{draft.routed_authority?.email}</Text></Card>
          <Card><Text style={styles.legalTitle}>Formal notice (English)</Text>
            <Field label="Subject" value={draft.draft_subject_en} onChangeText={(value) => setDraft((current) => current ? { ...current, draft_subject_en: value } : current)} />
            <Field label="Notice body" value={draft.draft_body_en} onChangeText={(value) => setDraft((current) => current ? { ...current, draft_body_en: value } : current)} multiline />
          </Card>
          <Card><Text style={styles.legalTitle}>तक्रार गोषवारा (मराठी)</Text><Text style={styles.bodyText}>{draft.draft_summary_mr}</Text></Card>
          <Card style={styles.legalCard}><Text style={styles.legalTitle}>⚖️  Legal grounding</Text>{draft.legal_citations.map((citation, index) => <Text key={index} style={styles.subtle}>•  {citation}</Text>)}</Card>
          <Button title="Continue to dispatch  →" onPress={() => setPage('dispatch')} />
        </ScrollView>
      </> : null)}

      {page === 'dispatch' && draft && <>
        <PageHeader title="Share your complaint" subtitle="Review the notice and choose how to share" onBack={() => setPage('draft')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.successIcon}><Text style={{ fontSize: 30 }}>📨</Text></View><Text style={styles.centerTitle}>Ready to share</Text><Text style={styles.subtleCenter}>Email opens your mail app with the PDF{draft.audio_url ? ' and audio recording' : ''} attached. Review and send there.{draft.routed_authority?.whatsapp ? ' WhatsApp sharing opens separately with a summary.' : ''}</Text>
          <Card><Text style={styles.legalTitle}>EMAIL RECIPIENT</Text><Text style={styles.cardTitle}>{draft.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{draft.routed_authority?.email}</Text></Card>
          {draft.routed_authority?.whatsapp && <Card><Text style={styles.legalTitle}>WHATSAPP SUMMARY</Text><Text style={styles.bodyText}>{draft.draft_summary_mr}</Text><Text style={styles.subtle}>Tracking: {draft.tracking_id}</Text></Card>}
          <Card style={styles.infoCard}><Text style={styles.infoTitle}>🔒  Review before sharing</Text><Text style={styles.subtle}>Your report includes GPS coordinates, your evidence, complaint text and any contact details you provided.</Text></Card>
          <Button title={busy ? 'Preparing…' : 'Open email with evidence'} onPress={() => void sendDispatch('EMAIL')} disabled={busy} />
          {draft.routed_authority?.whatsapp && <Button title="Open WhatsApp summary" onPress={() => void sendDispatch('WHATSAPP')} disabled={busy} secondary />}
          {draft.domain === 'NOISE' && <Button title="Open police dialler · 112" onPress={() => void Linking.openURL('tel:112')} secondary />}
          {busy && <ActivityIndicator color={green} />}
          <Button title="Back to draft" onPress={() => setPage('draft')} secondary />
          <Button title="Back to tracker" onPress={() => { setPage('tracker'); setDraft(null); }} disabled={busy} secondary />
        </ScrollView>
      </>}

      {page === 'verify' && <>
        <PageHeader title="Ground re-audit" subtitle={detail?.tracking_id ?? draft?.tracking_id} onBack={() => setPage(detail ? 'draft' : 'tracker')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card style={styles.locationCard}><Text style={styles.legalTitle}>📍  Visit the original site</Text><Text style={styles.cardTitle}>{detail?.address_landmark ?? draft?.address_landmark}</Text><Text style={styles.subtle}>A fresh photo and GPS position are used to review whether the concern has been resolved.</Text></Card>
          {detail?.photo_urls?.[0] && <View><Text style={styles.fieldLabel}>ORIGINAL REPORT PHOTO</Text><Image source={{ uri: asDataUri(detail.photo_urls[0]) }} style={styles.verifyPhoto} /></View>}
          {verificationPhoto ? <Image source={{ uri: verificationPhoto.uri }} style={styles.verifyPhoto} /> : <View style={styles.verifyPlaceholder}><Text style={{ fontSize: 34 }}>📷</Text><Text style={styles.subtle}>Capture a current photo at the reported location</Text></View>}
          <Button title={verificationPhoto ? 'Retake re-audit photo' : 'Take re-audit photo'} onPress={() => void pickVerificationPhoto()} secondary />
          <Field label="Observation (optional)" value={verificationNote} onChangeText={setVerificationNote} placeholder="Is the issue still present?" multiline />
          <Button title={busy ? 'Submitting…' : 'Submit resolution check'} onPress={() => void submitVerification()} disabled={busy || !verificationPhoto} />
          {verificationResult && <Card style={styles.aiCard}><Text style={styles.legalTitle}>🤖  AI comparative review</Text><Text style={styles.cardTitle}>{verificationResult.ai_verdict.replaceAll('_', ' ')} · {(verificationResult.ai_confidence * 100).toFixed(0)}%</Text><Text style={styles.bodyText}>{verificationResult.ai_notes_en}</Text><Text style={styles.bodyText}>{verificationResult.ai_notes_mr}</Text><Text style={styles.reportMeta}>{verificationResult.gps_valid ? `GPS confirmed · ${verificationResult.distance_from_original_m.toFixed(0)} m from the report` : 'GPS validation failed'} · {(verificationResult.final_status ?? '').replaceAll('_', ' ')}</Text><Button title="Back to tracker" onPress={() => { setPage('tracker'); setVerificationPhoto(null); setVerificationResult(null); setDetail(null); }} secondary /></Card>}
        </ScrollView>
      </>}
      {page === 'noise' && <>
        <PageHeader title="Noise evidence" subtitle={categoryLabel(category)} onBack={() => setPage('category')} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <NoiseCapture prepareLocation={getLocation} onCaptured={setNoiseEvidence} initialEvidence={noiseEvidence} />
          {location && <Card><Text style={styles.cardTitle}>📍 {location.address}</Text><Text style={styles.subtle}>Location recorded by this phone</Text></Card>}
          <Field label="What you observed (optional)" value={notes} onChangeText={setNotes} placeholder="Sound system, landmark or disturbance…" />
          <Card style={styles.noteCard}><Text style={styles.noteText}>Police determine permissions, valid festival exemptions and notified silence-zone status. This report is sent to police, with a separate dialler shortcut for 112.</Text></Card>
          <Button title={busy ? 'Preparing…' : 'Prepare police notice →'} disabled={busy || !noiseEvidence} onPress={() => void prepareFastDraft()} />
        </ScrollView>
      </>}
    </KeyboardAvoidingView>
    <View style={styles.tabBar}>{tabs.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.title} accessibilityState={{ selected: domain === tab.key }} disabled={busy} onPress={() => { setDomain(tab.key); setPage('tracker'); setDetail(null); setDraft(null); setNoiseEvidence(null); }} style={[styles.tab, domain === tab.key && styles.tabSelected]}><Text style={styles.tabIcon}>{tab.emoji}</Text><Text style={[styles.tabLabel, domain === tab.key && styles.tabLabelSelected]}>{tab.title}</Text></Pressable>)}</View>

    <ProfileSheet visible={profileOpen} onClose={closeProfile}>
        <Field label="Full name" value={profileDraft.name} onChangeText={(name) => setProfileDraft((p) => ({ ...p, name }))} placeholder="Your name" />
        <Field label="Phone number" value={profileDraft.phone} onChangeText={(phone) => setProfileDraft((p) => ({ ...p, phone }))} placeholder="10-digit mobile number" keyboardType="phone-pad" />
        <Field label="Email (optional)" value={profileDraft.email} onChangeText={(email) => setProfileDraft((p) => ({ ...p, email }))} placeholder="you@example.com" keyboardType="email-address" />
        <Button title="Save profile" onPress={() => void saveProfile()} /><Button title="Cancel" onPress={closeProfile} secondary />
    </ProfileSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E8E2', padding: 8, gap: 4 }, tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, gap: 3 }, tabSelected: { backgroundColor: '#E4F1E8' }, tabIcon: { fontSize: 21 }, tabLabel: { fontSize: 11, fontWeight: '700', color: '#738078' }, tabLabelSelected: { color: green },
  safe: { flex: 1, backgroundColor: '#F6F8F4' }, scroll: { padding: 20, paddingBottom: 36, gap: 13 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#F6F8F4' },
  brandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E5F1E8', alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 17, fontWeight: '800', color: dark }, subtle: { color: '#738078', fontSize: 12, lineHeight: 18 },
  avatar: { height: 37, width: 37, borderRadius: 19, backgroundColor: '#E8EFE9', justifyContent: 'center', alignItems: 'center' }, avatarText: { color: green, fontWeight: '700' }, refresh: { padding: 4 },
  hero: { backgroundColor: dark, borderRadius: 24, padding: 23, gap: 12, marginBottom: 8 }, eyebrow: { color: '#ACD6B6', fontWeight: '800', letterSpacing: 1.6, fontSize: 10 }, heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', lineHeight: 33 }, heroCopy: { color: '#CFDED3', lineHeight: 21, fontSize: 14, marginBottom: 4 },
  button: { minHeight: 50, borderRadius: 15, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: green, marginTop: 3 }, buttonText: { color: '#FFF', fontWeight: '800', fontSize: 14 }, buttonSecondary: { backgroundColor: '#E8F0EA', borderColor: '#D4E2D7', borderWidth: 1 }, buttonSecondaryText: { color: green }, buttonDisabled: { opacity: 0.55 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 1 }, sectionTitle: { color: dark, fontWeight: '800', fontSize: 18 }, count: { color: '#839087', fontSize: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#E9EEE9', padding: 16, gap: 9 }, emptyCard: { alignItems: 'center', padding: 24 }, emptyIcon: { fontSize: 33 }, cardTitle: { color: dark, fontSize: 15, fontWeight: '800' }, subtleCenter: { color: '#738078', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  reportCard: { gap: 11 }, reportTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, reportIcon: { fontSize: 23, width: 42, height: 42, textAlign: 'center', textAlignVertical: 'center', backgroundColor: '#EFF5F0', borderRadius: 14, overflow: 'hidden' }, reportMeta: { color: '#87928B', fontSize: 11, marginTop: 4 }, chevron: { color: '#A8B3AB', fontSize: 27 }, reportAddress: { fontSize: 12, color: '#5F6D64' }, reportBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, statusPill: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 9, fontWeight: '800' }, statusGreen: { backgroundColor: '#E0F1E3', color: '#2D774A' }, statusAmber: { backgroundColor: '#FFF3DB', color: '#9D6A10' },
  aiCard: { backgroundColor: '#F0F6EF', borderColor: '#DDEBDD' }, aiRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, footer: { textAlign: 'center', color: '#A0AAA3', fontSize: 11, marginVertical: 12 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }, back: { fontSize: 36, lineHeight: 38, color: green, width: 27 }, pageTitle: { color: dark, fontSize: 21, fontWeight: '800' },
  noteCard: { backgroundColor: '#F0F6EF', borderColor: '#DDEBDD' }, noteText: { color: '#4C6654', fontSize: 13, lineHeight: 20 }, categoryCard: { padding: 14 }, categorySelected: { borderColor: green, backgroundColor: '#F5FAF5' }, categoryTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, categoryEmoji: { width: 37, fontSize: 22 }, categoryDesc: { color: '#758078', fontSize: 12, lineHeight: 18, marginTop: 4 }, checkbox: { width: 23, height: 23, borderWidth: 1.5, borderColor: '#CFD7D0', borderRadius: 7, color: '#FFF', textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' }, checkboxSelected: { backgroundColor: green, borderColor: green, fontWeight: '900' },
  legalCard: { backgroundColor: '#F4F5F0' }, legalTitle: { color: green, fontWeight: '800', fontSize: 13 }, locationCard: { backgroundColor: '#EFF6EF', borderColor: '#DCEBDD' }, locationLabel: { color: '#6E8D73', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, locationTitle: { color: dark, fontWeight: '800', fontSize: 15 },
  guideCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, stepNumber: { height: 30, width: 30, borderRadius: 15, backgroundColor: green, alignItems: 'center', justifyContent: 'center' }, stepNumberText: { color: 'white', fontWeight: '800' }, guideBadge: { color: '#6D8F73', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, infoCard: { backgroundColor: '#F0F5F5', borderColor: '#E0EBEB' }, infoTitle: { color: '#375B5B', fontWeight: '800' },
  cameraPage: { flex: 1 }, cameraFrame: { flex: 1, marginHorizontal: 12, overflow: 'hidden', borderRadius: 23, backgroundColor: '#19241D' }, cameraFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 }, cameraOverlay: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 15, backgroundColor: 'rgba(16,34,24,0.82)', padding: 14, gap: 8 }, cameraTip: { color: 'white', fontWeight: '600', fontSize: 13, lineHeight: 19 }, tilt: { color: '#BCE1C2', fontSize: 11, fontWeight: '800' }, cameraFooter: { padding: 18, gap: 8 }, photoDots: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginBottom: 5 }, dot: { height: 8, width: 8, borderRadius: 5, backgroundColor: '#D4DDD5' }, dotDone: { backgroundColor: '#90C59A' }, dotCurrent: { backgroundColor: green, width: 20 },
  photoGrid: { flexDirection: 'row', gap: 8 }, photoItem: { flex: 1, gap: 4 }, photoThumb: { width: '100%', height: 102, borderRadius: 13, backgroundColor: '#E5EAE5' }, photoCaption: { color: '#516157', fontSize: 10, fontWeight: '700' }, removeText: { color: '#B84D40', fontSize: 10, fontWeight: '700' }, duplicateRow: { flexDirection: 'row', alignItems: 'center', borderTopColor: '#F0E3C5', borderTopWidth: 1, paddingTop: 9 }, witnessButton: { color: green, fontWeight: '800', fontSize: 12, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#E8F0EA', borderRadius: 9 }, fieldWrap: { gap: 6, marginTop: 4 }, fieldLabel: { color: '#52635A', fontSize: 12, fontWeight: '700' }, input: { backgroundColor: '#FBFCFA', borderColor: '#DDE4DD', borderWidth: 1, minHeight: 47, borderRadius: 12, paddingHorizontal: 12, color: dark, fontSize: 14 }, inputMultiline: { minHeight: 92, paddingTop: 12 }, optionalCard: { backgroundColor: '#FFFAF3', borderColor: '#F3EAD8' },
  trackingBanner: { backgroundColor: dark, borderRadius: 20, padding: 20, gap: 5 }, trackingId: { fontSize: 21, color: 'white', fontWeight: '900', letterSpacing: 0.5 }, warningCard: { backgroundColor: '#FFF8EA', borderColor: '#F0DFB8' }, warningTitle: { color: '#9C6A17', fontWeight: '800' }, bodyText: { color: '#3E4D43', fontSize: 13, lineHeight: 20 }, divider: { height: 1, backgroundColor: '#E7ECE7', marginVertical: 3 }, subject: { color: dark, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  successIcon: { alignSelf: 'center', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#E6F2E8', marginTop: 10 }, centerTitle: { textAlign: 'center', color: dark, fontSize: 22, fontWeight: '900' }, verifyPlaceholder: { minHeight: 180, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD8CD', borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#F0F5EF', padding: 15 }, verifyPhoto: { height: 240, borderRadius: 18, backgroundColor: '#E3E8E3' },
});
