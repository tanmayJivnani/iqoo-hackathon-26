import { ScrollView, Text } from 'react-native';
import { Button, Card, Field, PageHeader } from '../../../components/ui';
import { NoiseCapture } from '../../../components/NoiseCapture';
import { categoryLabel } from '../../../data/civic';
import { styles } from '../styles';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
type Props = Pick<ComplaintFlow, 'category' | 'setPage' | 'getLocation' | 'setNoiseEvidence' | 'noiseEvidence' | 'location' | 'notes' | 'setNotes' | 'busy' | 'prepareFastDraft'> & Pick<ScreenChrome, 'onContentScroll'>;
export function NoiseScreen({ category, setPage, getLocation, setNoiseEvidence, noiseEvidence, location, notes, setNotes, busy, prepareFastDraft, onContentScroll }: Props) {
  return (<>
        <PageHeader title="Noise evidence" subtitle={categoryLabel(category)} onBack={() => setPage('category')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <NoiseCapture prepareLocation={getLocation} onCaptured={setNoiseEvidence} initialEvidence={noiseEvidence} />
          {location && <Card><Text style={styles.cardTitle}>📍 {location.address}</Text><Text style={styles.subtle}>Location recorded by this phone</Text></Card>}
          <Field label="What you observed (optional)" value={notes} onChangeText={setNotes} placeholder="Sound system, landmark or disturbance…" />
          <Card style={styles.noteCard}><Text style={styles.noteText}>Police determine permissions, valid festival exemptions and notified silence-zone status. This report is sent to police, with a separate dialler shortcut for 112.</Text></Card>
          <Button title={busy ? 'Preparing…' : 'Prepare police notice →'} disabled={busy || !noiseEvidence} onPress={() => void prepareFastDraft()} />
        </ScrollView>
      </>);
}
