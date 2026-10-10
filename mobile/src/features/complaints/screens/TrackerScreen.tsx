import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { Button, Card } from '../../../components/ui';
import { apiDate, isResolved } from '../../../lib/complaint-flow';
import { allCategories, tabs, categoryLabel } from '../../../data/civic';
import { styles } from '../styles';
import { colors } from '../../../theme';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
const green = colors.primary;
type Props = Pick<ComplaintFlow, 'domain' | 'visibleComplaints' | 'trackerError' | 'refresh' | 'loading' | 'startComplaint' | 'openDetail'> & Pick<ScreenChrome, 'onTrackerScroll' | 'homeHeaderHeight' | 'heroHeight'>;
export function TrackerScreen({ domain, visibleComplaints, trackerError, refresh, loading, startComplaint, openDetail, onTrackerScroll, homeHeaderHeight, heroHeight }: Props) {
  return (<>
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
      </>);
}
