import { AiProviderSelector } from '../../../components/AiProviderSelector';
import { EvidencePhotos } from '../../../components/EvidencePhotos';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Field, PageHeader } from '../../../components/ui';
import { categoryLabel } from '../../../data/civic';
import { styles } from '../styles';
import { colors } from '../../../theme';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
const green = colors.primary;
type Props = Pick<ComplaintFlow, 'aiSettings' | 'location' | 'getLocation' | 'photos' | 'photoGuides' | 'openCamera' | 'nearbyComplaints' | 'upvoteNearby' | 'maxEvidencePhotos' | 'domain' | 'busy' | 'notes' | 'setNotes' | 'perpetratorName' | 'setPerpetratorName' | 'perpetratorPhone' | 'setPerpetratorPhone' | 'perpetratorPhotos' | 'attachOffenderPhoto' | 'prepareFastDraft' | 'setPage'> & Pick<ScreenChrome, 'onContentScroll'>;
export function EvidenceReviewScreen({ aiSettings, location, getLocation, photos, photoGuides, openCamera, nearbyComplaints, upvoteNearby, maxEvidencePhotos, domain, busy, notes, setNotes, perpetratorName, setPerpetratorName, perpetratorPhone, setPerpetratorPhone, perpetratorPhotos, attachOffenderPhoto, prepareFastDraft, setPage, onContentScroll }: Props) {
  return (<>
        <PageHeader title="Review evidence" subtitle="Step 3 of 5 · Check your photos and add context" onBack={() => setPage('capture')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <AiProviderSelector settings={aiSettings} disabled={busy} />
          <Card style={styles.locationCard}><Text style={styles.locationLabel}>📍 GPS LOCATION</Text><Text style={styles.locationTitle}>{location?.address ?? 'GPS position required'}</Text><Text style={styles.subtle}>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Acquire GPS before continuing'}</Text>{!location && <Button title="Retry GPS location" onPress={() => void getLocation()} secondary />}</Card>
          <EvidencePhotos photos={photos} guides={photoGuides} onRetake={index => void openCamera(index)} />
          {nearbyComplaints.length > 0 && <Card style={styles.warningCard}><Text style={styles.warningTitle}>📍  Nearby reports within 30 m</Text><Text style={styles.subtle}>A similar open report may already cover this location. Add your name as a witness or continue with your own evidence.</Text>{nearbyComplaints.map((item) => <View key={item.id} style={styles.duplicateRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{categoryLabel(item.issue_type)}</Text><Text style={styles.reportMeta}>{item.tracking_id} · {item.distance_meters.toFixed(0)} m · {item.witness_count} witnesses</Text></View><Pressable onPress={() => void upvoteNearby(item.id)}><Text style={styles.witnessButton}>+ Witness</Text></Pressable></View>)}</Card>}
          <Card style={styles.infoCard}><Text style={styles.infoTitle}>{aiSettings.mode === 'LOCAL_QWEN_35' ? 'Qwen3.5 analyzes your evidence' : 'AI prepares your observations'}</Text><Text style={styles.subtle}>{aiSettings.mode === 'LOCAL_QWEN_35' ? 'Qwen3.5 analyzes these photos locally. Add notes for context the photos cannot show.' : 'Your photos are analyzed to fill the complaint template. Add notes only for details the photos cannot show.'}</Text></Card>
          {photos.length < maxEvidencePhotos && <Button title={domain === 'TREES' ? 'Take the close-up photo' : `Add another evidence photo (${photos.length}/3)`} onPress={() => setPage('capture')} disabled={busy} secondary />}
          <Field label="Your observations (optional)" value={notes} onChangeText={setNotes} placeholder="Describe the visible damage or immediate danger…" multiline />
          <Card style={styles.optionalCard}><View style={styles.aiRow}><Text style={{ fontSize: 21 }}>👷</Text><View><Text style={styles.cardTitle}>Offender or equipment evidence</Text><Text style={styles.subtle}>Optional · Do not approach unsafe activity</Text></View></View>
            <Field label="Person or contractor (optional)" value={perpetratorName} onChangeText={setPerpetratorName} placeholder="Name or identifying details" />
            <Field label="Phone or vehicle registration (optional)" value={perpetratorPhone} onChangeText={setPerpetratorPhone} placeholder="Phone / vehicle number" />
            <Button title={`＋  Add evidence photo (${perpetratorPhotos.length}/3)`} onPress={() => void attachOffenderPhoto()} secondary />
          </Card>
          <Card style={styles.noteCard}><Text style={styles.noteText}>A notice is generated from your selected issue and evidence. It requests authority inspection; it does not certify a violation.</Text></Card>
          <Button title={busy ? 'Preparing notice…' : aiSettings.mode === 'LOCAL_QWEN_35' ? 'Prepare notice with local Qwen3.5 →' : 'Analyze photos & prepare notice →'} onPress={() => void prepareFastDraft()} disabled={busy || (domain === 'TREES' ? photos.length !== 2 : !photos.length)} />
          {busy && <ActivityIndicator color={green} />}
        </ScrollView>
      </>);
}
