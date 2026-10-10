import { ActivityIndicator, Linking, ScrollView, Text, View } from 'react-native';
import { Button, Card, PageHeader } from '../../../components/ui';
import { styles } from '../styles';
import { colors } from '../../../theme';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
const green = colors.primary;
type Props = Pick<ComplaintFlow, 'draft' | 'busy' | 'sendDispatch' | 'setPage' | 'setDraft'> & Pick<ScreenChrome, 'onContentScroll'>;
export function DispatchScreen({ draft, busy, sendDispatch, setPage, setDraft, onContentScroll }: Props) {
  return (draft ? (<>
        <PageHeader title="Share your complaint" subtitle="Review the notice and choose how to share" onBack={() => setPage('draft')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <View style={styles.successIcon}><Text style={{ fontSize: 30 }}>📨</Text></View><Text style={styles.centerTitle}>Ready to share</Text><Text style={styles.subtleCenter}>Email opens your mail app with the PDF{draft.audio_url ? ', audio recording' : ''}{draft.video_url ? ' and video' : ''} attached. Review and send there.{draft.routed_authority?.whatsapp ? ' WhatsApp sharing opens separately with a summary.' : ''}</Text>
          <Card><Text style={styles.legalTitle}>EMAIL RECIPIENT</Text><Text style={styles.cardTitle}>{draft.routed_authority?.name ?? 'PMC Tree Authority'}</Text><Text style={styles.subtle}>{draft.routed_authority?.email}</Text></Card>
          {draft.routed_authority?.whatsapp && <Card><Text style={styles.legalTitle}>WHATSAPP SUMMARY</Text><Text style={styles.bodyText}>{draft.draft_summary_mr}</Text><Text style={styles.subtle}>Tracking: {draft.tracking_id}</Text></Card>}
          <Card style={styles.infoCard}><Text style={styles.infoTitle}>🔒  Review before sharing</Text><Text style={styles.subtle}>Your report includes GPS coordinates, your evidence, complaint text and any contact details you provided.</Text></Card>
          {(draft.audio_url || draft.video_url) && <Card>
            <Text style={styles.legalTitle}>Email attachments</Text>
            <Text style={styles.subtle}>Report PDF</Text>
            {draft.audio_url && <Text style={styles.subtle}>Audio recording ({draft.audio_url.endsWith('.wav') ? 'WAV' : 'M4A'})</Text>}
            {draft.video_url && <Text style={styles.subtle}>Video recording (MP4)</Text>}
            <Text style={styles.subtle}>These files are attached together when you open the email.</Text>
          </Card>}
          <Button title={busy ? 'Preparing email…' : draft.video_url ? 'Email PDF, audio and video' : draft.audio_url ? 'Email PDF and audio recording' : 'Open email with evidence'} onPress={() => void sendDispatch('EMAIL')} disabled={busy} />
          {draft.routed_authority?.whatsapp && <Button title="Open WhatsApp summary" onPress={() => void sendDispatch('WHATSAPP')} disabled={busy} secondary />}
          {draft.domain === 'NOISE' && <Button title="Open police dialler · 112" onPress={() => void Linking.openURL('tel:112')} secondary />}
          {busy && <ActivityIndicator color={green} />}
          <Button title="Back to draft" onPress={() => setPage('draft')} secondary />
          <Button title="Back to tracker" onPress={() => { setPage('tracker'); setDraft(null); }} disabled={busy} secondary />
        </ScrollView>
      </>) : null);
}
