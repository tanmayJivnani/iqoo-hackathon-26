import { ScrollView, Text, View } from 'react-native';
import { Button, Card, PageHeader } from '../../../components/ui';
import { categoryLabel } from '../../../data/civic';
import { styles } from '../styles';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
type Props = Pick<ComplaintFlow, 'domain' | 'category' | 'photoGuides' | 'setPage'> & Pick<ScreenChrome, 'insets'>;
export function GuidanceScreen({ domain, category, photoGuides, setPage, insets }: Props) {
  return (<>
        <PageHeader title="Pune Fast Complaint" subtitle={categoryLabel(category)} onBack={() => setPage('category')} />
        <ScrollView contentContainerStyle={styles.captureScroll}>
          <View style={styles.captureIntro}>
            <Text style={styles.captureEyebrow}>PHOTO EVIDENCE</Text>
            <Text style={styles.captureTitle}>{domain === 'TREES' ? 'Two photos.\nA clearer picture.' : 'Show the concern.'}</Text>
            <Text style={styles.captureDescription}>{domain === 'TREES' ? 'Capture the whole tree and its surroundings, then the issue up close.' : 'Take a clear photo from a safe place.'}</Text>
          </View>
          {(domain === 'TREES' ? photoGuides : photoGuides.slice(0, 1)).map((guide, index) => <Card key={guide.badge} style={styles.captureGuideRow}>
            <View style={styles.captureStepNumber}><Text style={styles.captureStepText}>{index + 1}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{guide.title}</Text><Text style={styles.subtle}>{index === 0 ? 'Include the surroundings and a nearby landmark.' : 'Make the damage or concern easy to see.'}</Text></View>
          </Card>)}
        </ScrollView>
        <View style={[styles.captureActions, { paddingBottom: insets.bottom + 20 }]}><Button title="Begin capture" onPress={() => setPage('capture')} /></View>
      </>);
}
