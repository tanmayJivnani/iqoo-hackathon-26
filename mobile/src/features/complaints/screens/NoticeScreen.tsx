import { RecordingPlayback } from "../../../components/RecordingPlayback";
import { EvidencePhotos } from '../../../components/EvidencePhotos';
import { Linking, ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, PageHeader } from '../../../components/ui';
import { isTimelocked, verificationLabel, reverificationMessage } from '../../../lib/complaint-flow';
import { API_BASE } from '../../../lib/api';
import { categoryLabel, domainFor } from '../../../data/civic';
import { photoBase64 } from '../types';
import { styles } from '../styles';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
type Props = Pick<ComplaintFlow, 'detail' | 'setDetail' | 'setPage' | 'draft' | 'noiseEvidence' | 'domain' | 'busy' | 'generateReportPdf' | 'sendDispatch' | 'photos' | 'photoGuides' | 'setDraft' | 'perpetratorPhotos' | 'setVerificationPhoto' | 'setVerificationResult' | 'setVerificationNote'> & Pick<ScreenChrome, 'onContentScroll'>;
export function NoticeScreen({ detail, setDetail, setPage, draft, noiseEvidence, domain, busy, generateReportPdf, sendDispatch, photos, photoGuides, setDraft, perpetratorPhotos, setVerificationPhoto, setVerificationResult, setVerificationNote, onContentScroll }: Props) {
  return ((detail ? <>
        <PageHeader title="Complaint details" subtitle={detail.tracking_id} onBack={() => { setDetail(null); setPage('tracker'); }} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <Card><Text style={styles.locationLabel}>ISSUE</Text><Text style={styles.cardTitle}>{categoryLabel(detail.issue_type)}</Text><Text style={styles.subtle}>📍 {detail.address_landmark}</Text><Text style={styles.reportMeta}>Status: {verificationLabel(detail.verification_status, detail.reverification_due_at)}</Text></Card>
          <Card><Text style={styles.legalTitle}>Routed authority</Text><Text style={styles.cardTitle}>{typeof detail.routed_authority === 'string' ? detail.routed_authority : detail.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{detail.target_email ?? (typeof detail.routed_authority === 'object' ? detail.routed_authority?.email : '')}</Text></Card>
          <Card><Text style={styles.legalTitle}>Formal grievance</Text><Text style={styles.cardTitle}>{detail.draft_subject_en}</Text><Text style={styles.bodyText}>{detail.draft_body_en}</Text></Card>
          {detail.pdf_path && <Button title="Open report PDF" onPress={() => void Linking.openURL(`${API_BASE}/api/v1/complaints/${encodeURIComponent(detail.id)}/download-pdf`)} secondary />}
          <Card><Text style={styles.legalTitle}>तक्रार गोषवारा</Text><Text style={styles.bodyText}>{detail.draft_summary_mr}</Text></Card>
          {detail.reverification_required !== false && <Button disabled={isTimelocked(detail.verification_status, detail.reverification_due_at)} title={isTimelocked(detail.verification_status, detail.reverification_due_at) ? reverificationMessage(detail.reverification_due_at) : "Reverify this concern"} onPress={() => { setVerificationPhoto(null); setVerificationResult(null); setVerificationNote(''); setPage('verify'); }} />}
          {(detail.audio_url || detail.video_url) && <RecordingPlayback key={detail.id}
            audioUri={detail.audio_url ? `${API_BASE}${detail.audio_url}` : undefined}
            videoUri={detail.video_url ? `${API_BASE}${detail.video_url}` : undefined} disabled={busy} />}
          {domainFor(detail.issue_type) === 'NOISE' && <Button title={busy ? 'Preparing email…' : detail.video_url ? 'Email PDF, audio and video' : 'Email PDF and audio recording'} onPress={() => void sendDispatch('EMAIL', detail)} disabled={busy} />}
          <Button title="Back to home page" onPress={() => { setDetail(null); setPage('tracker'); }} secondary />
        </ScrollView>
      </> : draft ? <>
        <PageHeader title="Review your notice" subtitle="Check the recipient and statement before sharing" onBack={() => setPage(domain === 'NOISE' ? 'noise' : 'review')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <View style={styles.trackingBanner}><Text style={styles.locationLabel}>TRACKING NUMBER</Text><Text style={styles.trackingId}>{draft.tracking_id}</Text><Text style={styles.subtle}>{draft.ai_provider === 'FAST_TEMPLATE' ? 'Prepared from your evidence and observations' : draft.ai_provider ? `Prepared with ${draft.ai_provider.replaceAll('_', ' ')}` : 'AI-assisted draft'}{draft.is_fallback ? ' · Offline draft' : ''}</Text></View>
          {(draft.audio_url || draft.video_url || (domain === 'NOISE' && noiseEvidence)) && <RecordingPlayback key={draft.tracking_id}
            audioUri={draft.audio_url ? `${API_BASE}${draft.audio_url}` : undefined}
            videoUri={draft.video_url ? `${API_BASE}${draft.video_url}` : undefined}
            localAudioUri={domain === 'NOISE' ? noiseEvidence?.uri : undefined}
            localVideoUri={domain === 'NOISE' ? noiseEvidence?.video_uri : undefined} disabled={busy} />}
          {!draft.complaint_id && <Card style={styles.warningCard}><Text style={styles.warningTitle}>⚠️ Local draft</Text><Text style={styles.subtle}>This draft is not yet saved on the server. Connect to the internet before expecting a server tracking record or PDF.</Text></Card>}
          {draft.is_category_mismatch && <Card style={styles.infoCard}><Text style={styles.legalTitle}>AI issue suggestion</Text><Text style={styles.cardTitle}>{categoryLabel(draft.ai_suggested_category ?? undefined)}</Text><Text style={styles.subtle}>{draft.mismatch_reason_en}</Text></Card>}
          {draft.ai_additional_category && <Card style={styles.infoCard}><Text style={styles.legalTitle}>Additional issue noticed</Text><Text style={styles.subtle}>{categoryLabel(draft.ai_additional_category)} · {draft.ai_additional_reason_en}</Text></Card>}
          {photos.length > 0 && <Card>
            <Text style={styles.legalTitle}>Evidence photos</Text>
            <EvidencePhotos photos={photos} guides={photoGuides} large />
          </Card>}
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>{draft.ai_provider === 'LOCAL_QWEN_OMNI' ? 'LOCAL OMNI · EVIDENCE OBSERVATIONS' : draft.ai_provider === 'LOCAL_QWEN_TEXT' ? 'LOCAL QWEN · CITIZEN OBSERVATIONS' : draft.ai_provider === 'FAST_TEMPLATE' ? 'REPORTED ISSUE' : 'ANALYSIS'}</Text><Text style={styles.cardTitle}>{categoryLabel(draft.issue_type)}</Text><Text style={styles.subtle}>Urgency: {draft.urgency_level.replaceAll('_', ' ')}{draft.estimated_tree_species ? `  ·  ${draft.estimated_tree_species}` : ''}</Text><Text style={styles.bodyText}>{draft.visual_damage_summary}</Text></Card>
          <Card><Text style={styles.legalTitle}>📍  Location and statutory route</Text><Text style={styles.cardTitle}>{draft.address_landmark}</Text><Text style={styles.subtle}>{draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)} · {draft.ward_name}</Text><View style={styles.divider} /><Text style={styles.cardTitle}>{draft.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{draft.routed_authority?.role}</Text><Text style={styles.reportMeta}>{draft.routed_authority?.email}</Text></Card>
          <Card><Text style={styles.legalTitle}>Formal notice (English)</Text>
            <Text style={styles.subtle}>Please review and edit the details before sending. This complaint will be sent in your name.</Text>
            <Field label="Subject" value={draft.draft_subject_en} onChangeText={(value) => setDraft((current) => current ? { ...current, draft_subject_en: value } : current)} />
            <Field label="Notice body" value={draft.draft_body_en} onChangeText={(value) => setDraft((current) => current ? { ...current, draft_body_en: value } : current)} multiline />
          </Card>
          <Card><Text style={styles.legalTitle}>तक्रार गोषवारा (मराठी)</Text><Text style={styles.bodyText}>{draft.draft_summary_mr}</Text></Card>
          <Card style={styles.legalCard}><Text style={styles.legalTitle}>⚖️  Legal grounding</Text>{draft.legal_citations.map((citation, index) => <Text key={index} style={styles.subtle}>•  {citation}</Text>)}</Card>
          {draft.complaint_id && <Button title={busy ? 'Generating report PDF…' : 'Generate full report PDF with photos'} onPress={() => void generateReportPdf(draft.complaint_id!, { draft_subject_en: draft.draft_subject_en, draft_body_en: draft.draft_body_en, draft_summary_mr: draft.draft_summary_mr, photos_base64: photos.map(photoBase64), perpetrator_photos_base64: perpetratorPhotos.map(photoBase64) })} disabled={busy} secondary />}
          <Button title="Continue to dispatch  →" onPress={() => setPage('dispatch')} />
        </ScrollView>
      </> : null));
}
