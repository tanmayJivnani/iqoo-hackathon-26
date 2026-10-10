import { verificationLabel } from '../../../lib/complaint-flow';
import { AiProviderSelector } from '../../../components/AiProviderSelector';
import { Image, ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, PageHeader } from '../../../components/ui';
import { asDataUri } from '../../../lib/api';
import { styles } from '../styles';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
type Props = Pick<ComplaintFlow, 'aiSettings' | 'detail' | 'draft' | 'setPage' | 'verificationPhoto' | 'pickVerificationPhoto' | 'verificationNote' | 'setVerificationNote' | 'submitVerification' | 'busy' | 'verificationResult' | 'setVerificationPhoto' | 'setVerificationResult' | 'setDetail'> & Pick<ScreenChrome, 'onContentScroll'>;
export function VerificationScreen({ aiSettings, detail, draft, setPage, verificationPhoto, pickVerificationPhoto, verificationNote, setVerificationNote, submitVerification, busy, verificationResult, setVerificationPhoto, setVerificationResult, setDetail, onContentScroll }: Props) {
  return (<>
        <PageHeader title="Reverify your concern" subtitle={detail?.tracking_id ?? draft?.tracking_id} onBack={() => setPage(detail ? 'draft' : 'tracker')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <AiProviderSelector settings={aiSettings} disabled={busy} />
          <Card style={styles.locationCard}><Text style={styles.legalTitle}>📍  Visit the original site</Text><Text style={styles.cardTitle}>{detail?.address_landmark ?? draft?.address_landmark}</Text><Text style={styles.subtle}>A fresh photo and GPS position are used to review whether the concern has been resolved.</Text></Card>
          {detail?.photo_urls?.[0] && <View><Text style={styles.fieldLabel}>ORIGINAL REPORT PHOTO</Text><Image source={{ uri: asDataUri(detail.photo_urls[0]) }} style={styles.verifyPhoto} /></View>}
          {verificationPhoto ? <Image source={{ uri: verificationPhoto.uri }} style={styles.verifyPhoto} /> : <View style={styles.verifyPlaceholder}><Text style={{ fontSize: 34 }}>📷</Text><Text style={styles.subtle}>Capture a current photo at the reported location</Text></View>}
          <Button title={verificationPhoto ? 'Retake photo' : 'Take a new photo'} onPress={() => void pickVerificationPhoto()} secondary />
          <Field label="Observation (optional)" value={verificationNote} onChangeText={setVerificationNote} placeholder="Is the issue still present?" multiline />
          <Button title={busy ? 'Submitting…' : 'Submit resolution check'} onPress={() => void submitVerification()} disabled={busy || !verificationPhoto} />
          {verificationResult && <Card style={styles.aiCard}><Text style={styles.legalTitle}>🤖  AI comparative review</Text><Text style={styles.cardTitle}>{verificationResult.ai_verdict.replaceAll('_', ' ')} · {(verificationResult.ai_confidence * 100).toFixed(0)}%</Text><Text style={styles.bodyText}>{verificationResult.ai_notes_en}</Text><Text style={styles.bodyText}>{verificationResult.ai_notes_mr}</Text><Text style={styles.reportMeta}>{verificationResult.gps_valid ? `GPS confirmed · ${verificationResult.distance_from_original_m.toFixed(0)} m from the report` : 'GPS validation failed'} · {verificationLabel(verificationResult.final_status)}</Text><Button title="Back to home page" onPress={() => { setPage('tracker'); setVerificationPhoto(null); setVerificationResult(null); setDetail(null); }} secondary /></Card>}
        </ScrollView>
      </>);
}
