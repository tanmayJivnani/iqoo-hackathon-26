import { BlurTargetView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MailComposer from 'expo-mail-composer';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, Image, Keyboard, KeyboardAvoidingView, Linking, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { apiDate, isResolved, isTimelocked } from '../lib/complaint-flow';
import { categoriesByDomain, allCategories, tabs, domainFor, categoryLabel, legalGrounding, type CivicDomain } from '../data/civic';
import { NoiseCapture } from '../components/NoiseCapture';
import { ProfileSheet } from '../components/ProfileSheet';
import { CategoryTabs } from '../components/CategoryTabs';
import { ScrollHeader } from '../components/ScrollHeader';
import { ReportHero } from '../components/ReportHero';
import { evaluateNoiseActionability, QUIET_RECORDING_MESSAGE, type NoiseEvidence } from '../lib/noise';
import { API_BASE, api, asDataUri, type Complaint, type ComplaintDetail, type Draft } from '../lib/api';

type Page = 'tracker' | 'category' | 'guidance' | 'review' | 'noise' | 'draft' | 'dispatch' | 'verify';
type Profile = { name: string; phone: string; email: string };
type Photo = { uri: string; base64: string };
type EvidenceLocation = { latitude: number; longitude: number; address: string; accuracy?: number | null };
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

export default function HomeScreen() {
  const blurTarget = useRef<View | null>(null);
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('tracker');
  const [domain, setDomain] = useState<CivicDomain>('TREES');
  const [homeHeaderHeight, setHomeHeaderHeight] = useState(66);
  const [heroHeight, setHeroHeight] = useState(288);
  const scrollScope = `${page}:${domain}`;
  const heroScrollY = useSharedValue(0);
  useEffect(() => { heroScrollY.set(0); }, [scrollScope, heroScrollY]);
  const scrollAnchor = useRef({ scope: scrollScope, y: 0 });
  const [navVisibility, setNavVisibility] = useState({ scope: scrollScope, hidden: false });
  if (navVisibility.scope !== scrollScope) setNavVisibility({ scope: scrollScope, hidden: false });
  const navHidden = navVisibility.scope === scrollScope && navVisibility.hidden;
  const [heroVisibility, setHeroVisibility] = useState({ scope: scrollScope, compact: false });
  if (heroVisibility.scope !== scrollScope) setHeroVisibility({ scope: scrollScope, compact: false });
  const heroCompact = heroVisibility.scope === scrollScope && heroVisibility.compact;
  const [refreshPosition, setRefreshPosition] = useState({ scope: scrollScope, atTop: true });
  const refreshAtTop = refreshPosition.scope !== scrollScope || refreshPosition.atTop;
  const onScrollPosition = useCallback((y: number) => {
    const atTop = y <= 0;
    setRefreshPosition(current => current.scope === scrollScope && current.atTop === atTop ? current : { scope: scrollScope, atTop });
    if (y >= 216 || y <= 32) {
      const compact = y >= 216;
      setHeroVisibility(current => current.scope === scrollScope && current.compact === compact ? current : { scope: scrollScope, compact });
    }
    if (scrollAnchor.current.scope !== scrollScope) scrollAnchor.current = { scope: scrollScope, y: 0 };
    const delta = y - scrollAnchor.current.y;
    if (y <= 8 || delta >= 48 || delta <= -10) {
      const hidden = y > 8 && delta > 0;
      scrollAnchor.current.y = y;
      setNavVisibility(current => current.scope === scrollScope && current.hidden === hidden ? current : { scope: scrollScope, hidden });
    }
  }, [scrollScope]);
  const onContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    onScrollPosition(Math.max(0, Math.min(contentOffset.y, Math.max(0, contentSize.height - layoutMeasurement.height))));
  }, [onScrollPosition]);
  const onTrackerScroll = useAnimatedScrollHandler(event => {
    const y = Math.max(0, Math.min(event.contentOffset.y, Math.max(0, event.contentSize.height - event.layoutMeasurement.height)));
    heroScrollY.set(y);
    scheduleOnRN(onScrollPosition, y);
  });
  const [capturedAt, setCapturedAt] = useState('');
  const [noiseEvidence, setNoiseEvidence] = useState<NoiseEvidence | null>(null);
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Profile>(blankProfile);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [nearbyComplaints, setNearbyComplaints] = useState<{ id: string; tracking_id: string; issue_type: string; distance_meters: number; witness_count: number; address_landmark: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [perpetratorPhotos, setPerpetratorPhotos] = useState<Photo[]>([]);
  const [notes, setNotes] = useState('');
  const [perpetratorName, setPerpetratorName] = useState('');
  const [perpetratorPhone, setPerpetratorPhone] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [location, setLocation] = useState<EvidenceLocation | null>(null);
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const operationRef = useRef(false);
  const captureRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pendingProfileStart, setPendingProfileStart] = useState(false);
  const closeProfile = useCallback(() => {
    Keyboard.dismiss(); setPendingProfileStart(false); setProfileOpen(false);
  }, []);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [verificationPhoto, setVerificationPhoto] = useState<Photo | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ ai_verdict: string; ai_confidence: number; ai_notes_en: string; ai_notes_mr: string; final_status: string; gps_valid: boolean; distance_from_original_m: number; reopen_count: number } | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
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
      void refresh();
    })();
  }, []);

  useEffect(() => {
    if (page === 'tracker') return;
    const backTargets: Record<Page, Page> = {
      tracker: 'tracker', category: 'tracker', guidance: 'category', noise: 'category',
      review: 'guidance', draft: detail ? 'tracker' : domain === 'NOISE' ? 'noise' : 'review', dispatch: 'draft', verify: detail ? 'draft' : 'tracker',
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'draft' && detail) setDetail(null);
      setPage(backTargets[page]);
      return true;
    });
    return () => subscription.remove();
  }, [page, detail, domain]);

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
    setNoiseEvidence(null); setCapturedAt('');
    setSelectedCategories([]); setPhotos([]); setNearbyComplaints([]); setNotes(''); setDraft(null); setDetail(null);
    setPerpetratorName(''); setPerpetratorPhone(''); setPerpetratorPhotos([]); setLocation(null);
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
    if (replaceIndex === null && photos.length >= 3) return;
    if (!location && !await getLocation()) return;
    const photo = await captureNativePhoto();
    if (!photo) return;
    setCapturedAt(new Date().toISOString());
    setPhotos(current => replaceIndex === null ? [...current, photo].slice(0, 3)
      : current.map((existing, index) => index === replaceIndex ? photo : existing));
    setPage('review');
  };

  const choosePhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, quality: 0.68, base64: true });
    if (result.canceled) return;
    const chosen = result.assets.slice(0, 3).filter((asset) => asset.base64).map((asset) => ({ uri: asset.uri, base64: asset.base64! }));
    if (!chosen.length) { Alert.alert('Photo required', 'Please select at least one readable photo.'); return; }
    if (!await getLocation()) return;
    setCapturedAt(new Date().toISOString()); setPhotos(chosen); setPage('review');
  };

  const attachOffenderPhoto = async () => {
    if (perpetratorPhotos.length >= 3) { Alert.alert('Photo limit', 'You can attach up to three optional photos.'); return; }
    const photo = await captureNativePhoto();
    if (photo) setPerpetratorPhotos(previous => [...previous, photo].slice(0, 3));
  };

  const prepareFastDraft = async () => {
    if (operationRef.current) return;
    if (!location || (domain === 'NOISE' ? !noiseEvidence : !photos.length)) { Alert.alert('Evidence required', 'Capture evidence and GPS before preparing the notice.'); return; }
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
    operationRef.current = true; setBusy(true);
    try {
      const audioBase64 = noiseEvidence ? await new File(noiseEvidence.uri).base64() : undefined;
      const videoBase64 = noiseEvidence?.video_uri ? await new File(noiseEvidence.video_uri).base64() : undefined;
      const response = await api<Draft>('/api/v1/complaints/fast-draft', { method: 'POST', signal: AbortSignal.timeout(100_000), body: JSON.stringify({
        issue_type: category, latitude: location.latitude, longitude: location.longitude, gps_accuracy_m: location.accuracy,
        captured_at: noiseEvidence?.captured_at || capturedAt, photos_base64: [...photos, ...perpetratorPhotos].map(photoBase64),
        audio_base64: audioBase64, video_base64: videoBase64, noise_evidence: noiseEvidence || undefined,
        citizen_notes: notes || null, citizen_name: profile.name || null, citizen_phone: profile.phone || null, citizen_email: profile.email || null,
        address_landmark: location.address, perpetrator_name: perpetratorName || null, perpetrator_phone: perpetratorPhone || null,
      }) });
      setDraft(response); setPage('draft'); void refresh();
    } catch (error) { Alert.alert('Notice not prepared', error instanceof Error ? error.message : 'Reconnect to the local backend and retry. Your captured evidence is still available.'); }
    finally { operationRef.current = false; setBusy(false); }
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
      const result = await api<{ email?: { ready: boolean; recipient: string; subject: string; body: string; attachment_url: string; audio_attachment_url?: string | null; video_attachment_url?: string | null }; whatsapp?: { deep_link_url: string } }>(
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
        const audioExtension = result.email.audio_attachment_url?.endsWith('.wav') ? 'wav' : 'm4a';
        const audioAttachment = result.email.audio_attachment_url ? await File.downloadFileAsync(`${API_BASE}${result.email.audio_attachment_url}`, new File(Paths.cache, `${draft.tracking_id}.${audioExtension}`), { idempotent: true, signal: AbortSignal.timeout(30_000) }) : null;
        const videoAttachment = result.email.video_attachment_url ? await File.downloadFileAsync(`${API_BASE}${result.email.video_attachment_url}`, new File(Paths.cache, `${draft.tracking_id}.mp4`), { idempotent: true, signal: AbortSignal.timeout(60_000) }) : null;
        await MailComposer.composeAsync({
          recipients: [result.email.recipient], subject: result.email.subject,
          body: result.email.body, attachments: [attachment.uri, ...(audioAttachment ? [audioAttachment.uri] : []), ...(videoAttachment ? [videoAttachment.uri] : [])],
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
    const photo = await captureNativePhoto();
    if (photo) setVerificationPhoto(photo);
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
    <RefreshControl refreshing={page === 'tracker' && loading} onRefresh={refresh}
      enabled={page === 'tracker' && (refreshAtTop || loading)} colors={[green]} progressBackgroundColor="#F6FCF8"
      progressViewOffset={insets.top + 12 + homeHeaderHeight + 16} style={{ flex: 1, marginTop: -insets.top, marginLeft: -insets.left, marginRight: -insets.right }}>
    {/* SwipeRefreshLayout requires one stable native content child; prevent RN flattening it. */}
    <View collapsable={false} style={{ flex: 1 }}>
    <BlurTargetView ref={blurTarget} style={{ flex: 1, marginTop: insets.top + 12, marginLeft: insets.left, marginRight: insets.right }}>
    <KeyboardAvoidingView style={{ flex: 1, paddingTop: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {page === 'tracker' && <>
        <Reanimated.ScrollView key={domain} onScroll={onTrackerScroll} scrollEventThrottle={16} contentContainerStyle={[styles.scroll, { paddingTop: homeHeaderHeight + 20 }]}>
          <View style={{ height: heroHeight + 24 }} />
          <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Your reports</Text><Text style={styles.count}>{visibleComplaints.length} {visibleComplaints.length === 1 ? 'report' : 'reports'}</Text></View>
          {trackerError && <Card style={styles.warningCard}><Text style={styles.warningTitle}>Reports unavailable</Text><Text style={styles.bodyText}>{trackerError}</Text><Button title="Retry" onPress={() => void refresh()} secondary /></Card>}
          {loading && !visibleComplaints.length ? <ActivityIndicator color={green} style={{ marginTop: 30 }} /> : !visibleComplaints.length && !trackerError ? <Card style={styles.emptyCard}><Text style={styles.emptyIcon}>{tabs.find(tab => tab.key === domain)?.emoji}</Text><Text style={styles.cardTitle}>No reports yet</Text><Text style={styles.subtleCenter}>Reports in this tab will appear here with their status.</Text><Button title="Start your first report" onPress={startComplaint} secondary /></Card> : visibleComplaints.map((item) => <Pressable key={item.id} onPress={() => void openDetail(item.id)}><Card style={styles.reportCard}>
            <View style={styles.reportTop}><Text style={styles.reportIcon}>{allCategories.find((c) => item.issue_type.includes(c.key))?.emoji ?? '🌿'}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{categoryLabel(item.issue_type)}</Text><Text style={styles.reportMeta}>{item.tracking_id} · {apiDate(item.created_at).toLocaleDateString()}</Text></View><Text style={styles.chevron}>›</Text></View>
            <Text style={styles.reportAddress}>📍 {item.address_landmark}</Text><View style={styles.reportBottom}><Text style={[styles.statusPill, isResolved(item.verification_status) ? styles.statusGreen : styles.statusAmber]}>{item.verification_status.replaceAll('_', ' ')}</Text><Text style={styles.reportMeta}>Urgency: {item.urgency_level.replaceAll('_', ' ')}</Text></View>
            {item.reverification_due_at && <Text style={styles.reportMeta}>Ground check due {apiDate(item.reverification_due_at).toLocaleString()}</Text>}
          </Card></Pressable>)}
          <Text style={styles.footer}>Capture · Review · Send from your email app</Text>
        </Reanimated.ScrollView>
      </>}

      {page === 'category' && <>
        <PageHeader title={`Report ${tabs.find(tab => tab.key === domain)?.title.toLowerCase()}`} subtitle="Choose the issue you observed" onBack={() => setPage('tracker')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
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
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>ISSUE SELECTED</Text><Text style={styles.locationTitle}>{categoryLabel(category)}</Text><Text style={styles.subtle}>Capture the concern and a nearby landmark from a safe place. AI will describe the visible evidence for your complaint.</Text></Card>
          {(categories.find((item) => item.key === category)?.guides ?? categories[0].guides).slice(0, 1).map((guide, index) => <Card key={guide.badge} style={styles.guideCard}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.guideBadge}>{guide.badge.toUpperCase()}</Text><Text style={styles.cardTitle}>{guide.title}</Text><Text style={styles.categoryDesc}>{guide.instruction}</Text></View></Card>)}
          <Card style={styles.infoCard}><Text style={styles.infoTitle}>📍  Location is attached</Text><Text style={styles.subtle}>Allow foreground location access so your report includes GPS coordinates and a nearby address.</Text></Card>
          <Button title="Open camera" onPress={() => void openCamera()} />
          <Button title="Choose existing photos" onPress={() => void choosePhotos()} secondary />
        </ScrollView>
      </>}

      {page === 'review' && <>
        <PageHeader title="Review evidence" subtitle="Step 3 of 5 · Check your photos and add context" onBack={() => setPage('guidance')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>📍 GPS LOCATION</Text><Text style={styles.locationTitle}>{location?.address ?? 'GPS position required'}</Text><Text style={styles.subtle}>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Acquire GPS before continuing'}</Text></Card>
          <View style={styles.photoGrid}>{photos.map((photo, index) => <View key={`${photo.uri}-${index}`} style={styles.photoItem}><Image source={{ uri: photo.uri }} style={styles.photoThumb} /><Text style={styles.photoCaption}>{index + 1}. {(categories.find((item) => item.key === category)?.guides ?? categories[0].guides)[index]?.badge}</Text><Pressable onPress={() => void openCamera(index)}><Text style={styles.removeText}>Retake</Text></Pressable></View>)}</View>
          {nearbyComplaints.length > 0 && <Card style={styles.warningCard}><Text style={styles.warningTitle}>📍  Nearby reports within 30 m</Text><Text style={styles.subtle}>A similar open report may already cover this location. Add your name as a witness or continue with your own evidence.</Text>{nearbyComplaints.map((item) => <View key={item.id} style={styles.duplicateRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{categoryLabel(item.issue_type)}</Text><Text style={styles.reportMeta}>{item.tracking_id} · {item.distance_meters.toFixed(0)} m · {item.witness_count} witnesses</Text></View><Pressable onPress={() => void upvoteNearby(item.id)}><Text style={styles.witnessButton}>+ Witness</Text></Pressable></View>)}</Card>}
          <Card style={styles.infoCard}><Text style={styles.infoTitle}>AI prepares your observations</Text><Text style={styles.subtle}>Your photos are analyzed to fill the complaint template. Add notes only for details the photos cannot show.</Text></Card>
          {photos.length < 3 && <Button title={`Add another evidence photo (${photos.length}/3)`} onPress={() => void openCamera()} disabled={busy} secondary />}
          <Field label="Your observations (optional)" value={notes} onChangeText={setNotes} placeholder="Describe the visible damage or immediate danger…" multiline />
          <Card style={styles.optionalCard}><View style={styles.aiRow}><Text style={{ fontSize: 21 }}>👷</Text><View><Text style={styles.cardTitle}>Offender or equipment evidence</Text><Text style={styles.subtle}>Optional · Do not approach unsafe activity</Text></View></View>
            <Field label="Person or contractor (optional)" value={perpetratorName} onChangeText={setPerpetratorName} placeholder="Name or identifying details" />
            <Field label="Phone or vehicle registration (optional)" value={perpetratorPhone} onChangeText={setPerpetratorPhone} placeholder="Phone / vehicle number" />
            <Button title={`＋  Add evidence photo (${perpetratorPhotos.length}/3)`} onPress={() => void attachOffenderPhoto()} secondary />
          </Card>
          <Card style={styles.noteCard}><Text style={styles.noteText}>A notice is generated from your selected issue and evidence. It requests authority inspection; it does not certify a violation.</Text></Card>
          <Button title={busy ? 'Analyzing photos and drafting…' : 'Analyze photos & prepare notice →'} onPress={() => void prepareFastDraft()} disabled={busy || !photos.length} />
          {busy && <ActivityIndicator color={green} />}
        </ScrollView>
      </>}

      {page === 'draft' && (detail ? <>
        <PageHeader title="Complaint details" subtitle={detail.tracking_id} onBack={() => { setDetail(null); setPage('tracker'); }} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <Card><Text style={styles.locationLabel}>ISSUE</Text><Text style={styles.cardTitle}>{categoryLabel(detail.issue_type)}</Text><Text style={styles.subtle}>📍 {detail.address_landmark}</Text><Text style={styles.reportMeta}>Status: {(detail.verification_status ?? 'PENDING_TIMELOCK').replaceAll('_', ' ')}</Text></Card>
          <Card><Text style={styles.legalTitle}>Routed authority</Text><Text style={styles.cardTitle}>{typeof detail.routed_authority === 'string' ? detail.routed_authority : detail.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{detail.target_email ?? (typeof detail.routed_authority === 'object' ? detail.routed_authority?.email : '')}</Text></Card>
          <Card><Text style={styles.legalTitle}>Formal grievance</Text><Text style={styles.cardTitle}>{detail.draft_subject_en}</Text><Text style={styles.bodyText}>{detail.draft_body_en}</Text></Card>
          {detail.pdf_path && <Button title="Open statutory PDF" onPress={() => void Linking.openURL(`${API_BASE}/api/v1/complaints/${encodeURIComponent(detail.id)}/download-pdf`)} secondary />}
          <Card><Text style={styles.legalTitle}>तक्रार गोषवारा</Text><Text style={styles.bodyText}>{detail.draft_summary_mr}</Text></Card>
          {detail.reverification_required !== false && <Button disabled={isTimelocked(detail.verification_status, detail.reverification_due_at)} title={isTimelocked(detail.verification_status, detail.reverification_due_at) ? "Photo check available after the reminder" : "📸  Submit ground re-audit"} onPress={() => { setVerificationPhoto(null); setVerificationResult(null); setVerificationNote(''); setPage('verify'); }} />}
          {detail.audio_url && <Button title="Open audio evidence" onPress={() => void Linking.openURL(`${API_BASE}${detail.audio_url}`)} secondary />}
          {detail.video_url && <Button title="Open video evidence" onPress={() => void Linking.openURL(`${API_BASE}${detail.video_url}`)} secondary />}
          <Button title="Back to tracker" onPress={() => { setDetail(null); setPage('tracker'); }} secondary />
        </ScrollView>
      </> : draft ? <>
        <PageHeader title="Review your notice" subtitle="Check the recipient and statement before sharing" onBack={() => setPage(domain === 'NOISE' ? 'noise' : 'review')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
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
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <View style={styles.successIcon}><Text style={{ fontSize: 30 }}>📨</Text></View><Text style={styles.centerTitle}>Ready to share</Text><Text style={styles.subtleCenter}>Email opens your mail app with the PDF{draft.audio_url ? ', audio recording' : ''}{draft.video_url ? ' and video' : ''} attached. Review and send there.{draft.routed_authority?.whatsapp ? ' WhatsApp sharing opens separately with a summary.' : ''}</Text>
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
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
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
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <NoiseCapture prepareLocation={getLocation} onCaptured={setNoiseEvidence} initialEvidence={noiseEvidence} />
          {location && <Card><Text style={styles.cardTitle}>📍 {location.address}</Text><Text style={styles.subtle}>Location recorded by this phone</Text></Card>}
          <Field label="What you observed (optional)" value={notes} onChangeText={setNotes} placeholder="Sound system, landmark or disturbance…" />
          <Card style={styles.noteCard}><Text style={styles.noteText}>Police determine permissions, valid festival exemptions and notified silence-zone status. This report is sent to police, with a separate dialler shortcut for 112.</Text></Card>
          <Button title={busy ? 'Preparing…' : 'Prepare police notice →'} disabled={busy || !noiseEvidence} onPress={() => void prepareFastDraft()} />
        </ScrollView>
      </>}
    </KeyboardAvoidingView>
    </BlurTargetView>
    {page === 'tracker' && <ReportHero key={domain} domain={domain} scrollY={heroScrollY} compact={heroCompact} blurTarget={blurTarget}
      headerHidden={navHidden} headerHeight={homeHeaderHeight} onExpandedHeight={setHeroHeight} onReport={startComplaint} />}
    {page === 'tracker' && <ScrollHeader hidden={navHidden} height={homeHeaderHeight} blurTarget={blurTarget} onHeight={setHomeHeaderHeight}>
      {page === 'tracker' && <View style={styles.homeHeader}>
        <View style={styles.brandMark}><Text style={{ fontSize: 22 }}>🌳</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.brand}>Pune Fast Complaint</Text><Text style={styles.subtle}>{tabs.find(tab => tab.key === domain)?.caption}</Text></View>
        <Pressable onPress={() => { setPendingProfileStart(false); setProfileDraft(profile); setProfileOpen(true); }} style={styles.avatar}><Text style={styles.avatarText}>{profile.name ? profile.name[0].toUpperCase() : '👤'}</Text></Pressable>
        <Pressable onPress={() => void refresh()} style={styles.refresh}><Text style={{ color: green, fontSize: 22 }}>⟳</Text></Pressable>
      </View>}
    <CategoryTabs domain={domain} disabled={busy} blurTarget={blurTarget} onSelect={(nextDomain) => {
      setDomain(nextDomain); setPage('tracker'); setDetail(null); setDraft(null); setNoiseEvidence(null);
    }} />
    </ScrollHeader>}
    </View>
    </RefreshControl>

    <ProfileSheet visible={profileOpen} onClose={closeProfile}>
        <Field label="Full name" value={profileDraft.name} onChangeText={(name) => setProfileDraft((p) => ({ ...p, name }))} placeholder="Your name" />
        <Field label="Phone number" value={profileDraft.phone} onChangeText={(phone) => setProfileDraft((p) => ({ ...p, phone }))} placeholder="10-digit mobile number" keyboardType="phone-pad" />
        <Field label="Email (optional)" value={profileDraft.email} onChangeText={(email) => setProfileDraft((p) => ({ ...p, email }))} placeholder="you@example.com" keyboardType="email-address" />
        <Button title="Save profile" onPress={() => void saveProfile()} /><Button title="Cancel" onPress={closeProfile} secondary />
    </ProfileSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8F4' }, scroll: { padding: 20, paddingBottom: 40, gap: 13 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
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

  photoGrid: { flexDirection: 'row', gap: 8 }, photoItem: { flex: 1, gap: 4 }, photoThumb: { width: '100%', height: 102, borderRadius: 13, backgroundColor: '#E5EAE5' }, photoCaption: { color: '#516157', fontSize: 10, fontWeight: '700' }, removeText: { color: '#B84D40', fontSize: 10, fontWeight: '700' }, duplicateRow: { flexDirection: 'row', alignItems: 'center', borderTopColor: '#F0E3C5', borderTopWidth: 1, paddingTop: 9 }, witnessButton: { color: green, fontWeight: '800', fontSize: 12, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#E8F0EA', borderRadius: 9 }, fieldWrap: { gap: 6, marginTop: 4 }, fieldLabel: { color: '#52635A', fontSize: 12, fontWeight: '700' }, input: { backgroundColor: '#FBFCFA', borderColor: '#DDE4DD', borderWidth: 1, minHeight: 47, borderRadius: 12, paddingHorizontal: 12, color: dark, fontSize: 14 }, inputMultiline: { minHeight: 92, paddingTop: 12 }, optionalCard: { backgroundColor: '#FFFAF3', borderColor: '#F3EAD8' },
  trackingBanner: { backgroundColor: dark, borderRadius: 20, padding: 20, gap: 5 }, trackingId: { fontSize: 21, color: 'white', fontWeight: '900', letterSpacing: 0.5 }, warningCard: { backgroundColor: '#FFF8EA', borderColor: '#F0DFB8' }, warningTitle: { color: '#9C6A17', fontWeight: '800' }, bodyText: { color: '#3E4D43', fontSize: 13, lineHeight: 20 }, divider: { height: 1, backgroundColor: '#E7ECE7', marginVertical: 3 }, subject: { color: dark, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  successIcon: { alignSelf: 'center', width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#E6F2E8', marginTop: 10 }, centerTitle: { textAlign: 'center', color: dark, fontSize: 22, fontWeight: '900' }, verifyPlaceholder: { minHeight: 180, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#CBD8CD', borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#F0F5EF', padding: 15 }, verifyPhoto: { height: 240, borderRadius: 18, backgroundColor: '#E3E8E3' },
});
