import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import * as MailComposer from 'expo-mail-composer';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, Linking } from 'react-native';
import { categoriesByDomain, domainFor, type CivicDomain } from '../data/civic';
import { isTimelocked, reverificationMessage } from '../lib/complaint-flow';
import { emailAttachmentPlan, prepareEmailAttachments, type EmailEvidencePayload } from '../lib/email-evidence';
import type { NoiseEvidence } from '../lib/noise';
import { API_BASE, api, type Complaint, type ComplaintDetail, type Draft } from '../lib/api';
import { blankProfile, photoBase64, previousPage, type Page, type Profile, type Photo } from '../features/complaints/types';
import { useEvidenceLocation } from './useEvidenceLocation';
import { useEvidenceCapture } from './useEvidenceCapture';
import { useLocalAI } from './useLocalAI';
import { useComplaintDraft } from './useComplaintDraft';
export function useComplaintFlow() {
  const aiSettings = useLocalAI();
  const [page, setPage] = useState<Page>('tracker');
  const [domain, setDomain] = useState<CivicDomain>('TREES');
  const { location, setLocation, nearbyComplaints, setNearbyComplaints, getLocation } = useEvidenceLocation(domain);
  const { photos, setPhotos, perpetratorPhotos, setPerpetratorPhotos, capturedAt, setCapturedAt,
    maxEvidencePhotos, captureNativePhoto, openCamera, choosePhotos, attachOffenderPhoto } = useEvidenceCapture({ domain, location, getLocation, setPage });
  const [noiseEvidence, setNoiseEvidence] = useState<NoiseEvidence | null>(null);
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Profile>(blankProfile);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [perpetratorName, setPerpetratorName] = useState('');
  const [perpetratorPhone, setPerpetratorPhone] = useState('');
  const [trackerError, setTrackerError] = useState<string | null>(null);
  const operationRef = useRef(false);
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
  const selectedGuides = (categories.find(item => item.key === category) ?? categories[0]).guides;
  const photoGuides = domain === 'TREES' ? [
    { title: 'Whole tree and location', badge: 'Overall view', instruction: 'Step back safely and show the entire tree, its base, and nearby street or landmarks. For a felled tree, show the whole affected site.' },
    { ...selectedGuides[selectedGuides.length - 1], title: 'Close-up of the issue', badge: 'Close-up' },
  ] : selectedGuides;
  const currentPhotoIndex = domain === 'TREES' ? Math.min(photos.length, 1) : 0;
  const currentPhotoGuide = photoGuides[currentPhotoIndex] ?? photoGuides[0];
  const { draft, setDraft, prepareFastDraft } = useComplaintDraft({ domain, category, location, noiseEvidence,
    setNoiseEvidence, photos, perpetratorPhotos, capturedAt, profile, notes, perpetratorName, perpetratorPhone,
    refresh, operationRef, setBusy, setPage, aiSettings });
  const visibleComplaints = complaints.filter(item => (item.domain || domainFor(item.issue_type)) === domain);

  async function refresh() {
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
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (page === 'draft' && detail) setDetail(null);
      setPage(previousPage(page, domain, Boolean(detail)));
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

  const openDetail = async (id: string) => {
    setBusy(true);
    try { setDetail(await api<ComplaintDetail>(`/api/v1/complaints/${id}`)); setPage('draft'); }
    catch (error) { Alert.alert('Could not open complaint', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const generateReportPdf = async (complaintId: string, reportFields: Record<string, unknown> = {}) => {
    if (operationRef.current) return;
    operationRef.current = true; setBusy(true);
    try {
      const pdf = await api<{ complaint_id: string; pdf_url: string }>('/api/v1/complaints/render-pdf', {
        method: 'POST', body: JSON.stringify({ ...reportFields, complaint_id: complaintId }),
      });
      setDetail(current => current?.id === complaintId ? { ...current, pdf_path: pdf.pdf_url } : current);
      await Linking.openURL(`${API_BASE}${pdf.pdf_url}`);
    } catch (error) {
      Alert.alert('Could not generate report PDF', error instanceof Error ? error.message : 'Reconnect to the backend and try again.');
    } finally { operationRef.current = false; setBusy(false); }
  };

  const sendDispatch = async (channel: 'EMAIL' | 'WHATSAPP', report: Draft | ComplaintDetail | null = draft) => {
    if (!report || operationRef.current) return;
    operationRef.current = true;
    setBusy(true);
    try {
      if (channel === 'EMAIL' && !(await MailComposer.isAvailableAsync())) {
        throw new Error('Set up an email app on this phone before sharing the report by email.');
      }
      const complaintId = report.complaint_id || ('id' in report ? report.id : `loc-${report.tracking_id}`);
      const isCurrentDraft = report === draft;
      const pdf = await api<{ complaint_id: string; pdf_url: string }>('/api/v1/complaints/render-pdf', {
        method: 'POST', body: JSON.stringify({
          ...report, complaint_id: complaintId,
          photo_base64: isCurrentDraft && photos[0] ? photoBase64(photos[0]) : undefined,
          photos_base64: isCurrentDraft ? photos.map(photoBase64) : undefined, perpetrator_photos_base64: isCurrentDraft ? perpetratorPhotos.map(photoBase64) : undefined,
        }),
      });
      // Keep the registered ID for retrying a failed dispatch without creating another report.
      setDraft(current => current?.tracking_id === report.tracking_id ? { ...current, complaint_id: pdf.complaint_id } : current);
      setDetail(current => current?.id === pdf.complaint_id ? { ...current, pdf_path: pdf.pdf_url } : current);
      const result = await api<{ email?: EmailEvidencePayload; whatsapp?: { deep_link_url: string } }>(
        '/api/v1/complaints/dispatch', { method: 'POST', body: JSON.stringify({
          complaint_id: pdf.complaint_id, confirmed_by_citizen: true, channels: [channel],
        }) },
      );
      if (channel === 'EMAIL') {
        if (!result.email?.ready) throw new Error('The email could not be prepared. Your report is saved; please retry.');
        const plan = emailAttachmentPlan({ ...report, domain: domainFor(report.issue_type) }, result.email);
        const attachments = await prepareEmailAttachments(plan, attachment => File.downloadFileAsync(
          `${API_BASE}${attachment.url}`,
          new File(Paths.cache, attachment.filename),
          { idempotent: true, signal: AbortSignal.timeout(60_000) },
        ));
        await MailComposer.composeAsync({
          recipients: [result.email.recipient], subject: result.email.subject,
          body: `${result.email.body}\n\nAttached evidence:\n${plan.map(attachment => attachment.filename).join('\n')}`,
          attachments,
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
    if (aiSettings.loading || aiSettings.importing) { Alert.alert('AI settings loading', 'Wait for model settings to finish loading.'); return; }
    if (isTimelocked(detail?.verification_status, detail?.reverification_due_at)) { Alert.alert('Reverify later', reverificationMessage(detail?.reverification_due_at)); return; }
    if (!detail || !verificationPhoto) { Alert.alert('Photo required', 'Take a new on-site photo before running the check.'); return; }
    setBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location access is required to reverify the concern on site.');
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const localText = aiSettings.mode === 'LOCAL_QWEN' ? await aiSettings.summarize({ issue: detail.issue_type, address: detail.address_landmark, original_observations: detail.visual_damage_summary, citizen_followup: verificationNote || 'No follow-up observations provided.' }, true) : undefined;
      const result = await api<{ ai_verdict: string; ai_confidence: number; ai_notes_en: string; ai_notes_mr: string; final_status: string; gps_valid: boolean; distance_from_original_m: number; reopen_count: number }>(`/api/v1/complaints/${detail.id}/verify`, { method: 'POST', body: JSON.stringify({
        complaint_id: detail.id, photo_base64: photoBase64(verificationPhoto),
        latitude: current.coords.latitude, longitude: current.coords.longitude,
        citizen_notes: verificationNote || null, ai_mode: aiSettings.mode, local_text: localText,
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

  return {
    aiSettings,
    page,
    domain,
    profile,
    profileOpen,
    closeProfile,
    profileDraft,
    setProfileDraft,
    setProfileOpen,
    setPendingProfileStart,
    saveProfile,
    busy,
    loading,
    refresh,
    startComplaint,
    setDomain,
    setPage,
    setDetail,
    setDraft,
    setNoiseEvidence,
    category,
    currentPhotoIndex,
    currentPhotoGuide,
    photos,
    maxEvidencePhotos,
    openCamera,
    choosePhotos,
    categories,
    selectedCategories,
    setSelectedCategories,
    draft,
    sendDispatch,
    location,
    getLocation,
    photoGuides,
    nearbyComplaints,
    upvoteNearby,
    notes,
    setNotes,
    perpetratorName,
    setPerpetratorName,
    perpetratorPhone,
    setPerpetratorPhone,
    perpetratorPhotos,
    attachOffenderPhoto,
    prepareFastDraft,
    noiseEvidence,
    detail,
    generateReportPdf,
    setVerificationPhoto,
    setVerificationResult,
    setVerificationNote,
    visibleComplaints,
    trackerError,
    openDetail,
    verificationPhoto,
    pickVerificationPhoto,
    verificationNote,
    submitVerification,
    verificationResult,
  };
}
export type ComplaintFlow = ReturnType<typeof useComplaintFlow>;
