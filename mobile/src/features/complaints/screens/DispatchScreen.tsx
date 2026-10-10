import { RecordingPlayback } from "../../../components/RecordingPlayback";
import { API_BASE } from "../../../lib/api";
import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { Button, Card, PageHeader } from '../../../components/ui';
import { styles } from '../styles';
import { colors } from '../../../theme';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
const green = colors.primary;
type Props = Pick<ComplaintFlow, 'draft' | 'noiseEvidence' | 'busy' | 'sendDispatch' | 'setPage' | 'setDraft'> & Pick<ScreenChrome, 'onContentScroll'>;
export function DispatchScreen({ draft, noiseEvidence, busy, sendDispatch, setPage, setDraft, onContentScroll }: Props) {
  return (draft ? (<>
        <PageHeader title="Share your complaint" subtitle="Choose how to share your complaint" onBack={() => setPage('draft')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <View style={styles.successIcon}><Text style={{ fontSize: 30 }}>📨</Text></View><Text style={styles.centerTitle}>Ready to share</Text><Text style={styles.subtleCenter}>Email opens your mail app with the PDF{draft.audio_url ? ', audio recording' : ''}{draft.video_url ? ' and video' : ''} attached. Send it from your email app.{draft.routed_authority?.whatsapp ? ' WhatsApp sharing opens separately with a summary.' : ''}</Text>
          {(draft.audio_url || draft.video_url) && <RecordingPlayback key={draft.tracking_id}
            audioUri={draft.audio_url ? `${API_BASE}${draft.audio_url}` : undefined}
            videoUri={draft.video_url ? `${API_BASE}${draft.video_url}` : undefined}
            localAudioUri={noiseEvidence?.uri} localVideoUri={noiseEvidence?.video_uri} disabled={busy} />}
          <Card><Text style={styles.legalTitle}>EMAIL RECIPIENT</Text><Text style={styles.cardTitle}>{draft.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{draft.routed_authority?.email}</Text></Card>
          {(draft.audio_url || draft.video_url) && <Card>
            <Text style={styles.legalTitle}>Email attachments</Text>
            <Text style={styles.subtle}>Report PDF</Text>
            {draft.audio_url && <Text style={styles.subtle}>Audio recording ({draft.audio_url.endsWith('.wav') ? 'WAV' : 'M4A'})</Text>}
            {draft.video_url && <Text style={styles.subtle}>Video recording (MP4)</Text>}
            <Text style={styles.subtle}>These files are attached together when you open the email.</Text>
          </Card>}
          <Button title={busy ? 'Preparing email…' : 'Send email'} onPress={() => void sendDispatch('EMAIL')} disabled={busy} />
          {draft.routed_authority?.whatsapp && <Button title="Send WhatsApp complaint" onPress={() => void sendDispatch('WHATSAPP')} disabled={busy} secondary />}
          {draft.domain === 'NOISE' && <Button title="Open police dialler · 112" onPress={() => void Linking.openURL('tel:112')} secondary />}
          {busy && <ActivityIndicator color={green} />}
          <Button title="Back to draft" onPress={() => setPage('draft')} />
          <Button title="Back to home page" onPress={() => { setPage('tracker'); setDraft(null); }} disabled={busy} secondary tone="neutral" />
        </ScrollView>
      </>) : null);
}
