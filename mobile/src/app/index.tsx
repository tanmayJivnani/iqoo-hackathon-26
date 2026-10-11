import { BlurTargetView } from 'expo-blur';
import { useRef } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field } from '../components/ui';
import { ProfileSheet } from '../components/ProfileSheet';
import { CategoryTabs } from '../components/CategoryTabs';
import { ScrollHeader } from '../components/ScrollHeader';
import { ReportHero } from '../components/ReportHero';
import { useComplaintFlow } from '../hooks/useComplaintFlow';
import { useScrollChrome } from '../hooks/useScrollChrome';
import { styles } from '../features/complaints/styles';
import { colors } from '../theme';
import { categoryPalettes } from '../theme';
import { CategoryTheme } from '../theme/CategoryTheme';
import { TrackerScreen } from '../features/complaints/screens/TrackerScreen';
import { PublicMapScreen } from '../features/complaints/screens/PublicMapScreen';
import { PdfScreen } from '../features/complaints/screens/PdfScreen';
import { CategoryScreen } from '../features/complaints/screens/CategoryScreen';
import { GuidanceScreen } from '../features/complaints/screens/GuidanceScreen';
import { CaptureScreen } from '../features/complaints/screens/CaptureScreen';
import { EvidenceReviewScreen } from '../features/complaints/screens/EvidenceReviewScreen';
import { NoticeScreen } from '../features/complaints/screens/NoticeScreen';
import { DispatchScreen } from '../features/complaints/screens/DispatchScreen';
import { VerificationScreen } from '../features/complaints/screens/VerificationScreen';
import { NoiseScreen } from '../features/complaints/screens/NoiseScreen';
const green = colors.primary;
export default function HomeScreen() {
  const flow = useComplaintFlow();
  const palette = categoryPalettes[flow.domain];
  const { page, domain, profile, profileOpen, closeProfile, profileDraft, setProfileDraft, setProfileOpen, setPendingProfileStart, saveProfile, busy, loading, refresh, startComplaint, setDomain, setPage, setDetail, setDraft, setNoiseEvidence } = flow;
  const blurTarget = useRef<View | null>(null);
  const insets = useSafeAreaInsets();
  const { homeHeaderHeight, setHomeHeaderHeight, heroHeight, setHeroHeight, heroScrollY,
    navHidden, heroCompact, refreshAtTop, onContentScroll, onTrackerScroll } = useScrollChrome(page, domain);
  if (!flow.sessionReady) return <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={green} /></SafeAreaView>;
  return <CategoryTheme domain={domain}><SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <RefreshControl refreshing={page === 'tracker' && loading} onRefresh={refresh}
      enabled={page === 'tracker' && (refreshAtTop || loading)} colors={[palette.primary]} progressBackgroundColor={palette.canvas}
      progressViewOffset={insets.top + 12 + homeHeaderHeight + 16} style={{ flex: 1, marginTop: -insets.top, marginLeft: -insets.left, marginRight: -insets.right }}>
    {/* SwipeRefreshLayout requires one stable native content child; prevent RN flattening it. */}
    <View collapsable={false} style={{ flex: 1 }}>
    <BlurTargetView ref={blurTarget} style={{ flex: 1, backgroundColor: palette.canvas, marginTop: insets.top + 12, marginLeft: insets.left, marginRight: insets.right }}>
    <KeyboardAvoidingView style={{ flex: 1, paddingTop: 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {page === 'tracker' && <TrackerScreen {...flow} onTrackerScroll={onTrackerScroll} homeHeaderHeight={homeHeaderHeight} heroHeight={heroHeight} />}

      {page === 'map' && <PublicMapScreen key={flow.mapComplaintId} setPage={setPage} complaintId={flow.mapComplaintId} />}
      {page === 'pdf' && <PdfScreen complaintId={flow.pdfComplaintId} onBack={() => setPage('draft')} />}

      {page === 'category' && <CategoryScreen {...flow} onContentScroll={onContentScroll} />}

      {page === 'guidance' && <GuidanceScreen {...flow} insets={insets} />}

      {page === 'capture' && <CaptureScreen {...flow} insets={insets} />}

      {page === 'review' && <EvidenceReviewScreen {...flow} onContentScroll={onContentScroll} />}

      {page === 'draft' && <NoticeScreen {...flow} onContentScroll={onContentScroll} />}

      {page === 'dispatch' && <DispatchScreen {...flow} onContentScroll={onContentScroll} />}

      {page === 'verify' && <VerificationScreen {...flow} onContentScroll={onContentScroll} />}

      {page === 'noise' && <NoiseScreen {...flow} onContentScroll={onContentScroll} />}

    </KeyboardAvoidingView>
    </BlurTargetView>
    {page === 'tracker' && <ReportHero key={domain} domain={domain} scrollY={heroScrollY} compact={heroCompact} blurTarget={blurTarget}
      headerHidden={navHidden} headerHeight={homeHeaderHeight} onExpandedHeight={setHeroHeight} onReport={startComplaint} />}
    {page === 'tracker' && <ScrollHeader hidden={navHidden} height={homeHeaderHeight} onHeight={setHomeHeaderHeight}>
      {page === 'tracker' && <View style={styles.homeHeader}>
        <View style={[styles.brandMark, { backgroundColor: '#FFFFFF' }]}><Image source={require('../../assets/images/civic-logo.png')} accessibilityLabel="Pune Fast Complaint logo" style={{ width: 48, height: 48 }} resizeMode="contain" /></View>
        <View style={{ flex: 1 }}><Text style={[styles.brand, { color: palette.text }]}>Pune Fast Complaint</Text><Text style={styles.subtle}>Super Fast and Easy complaint filing</Text></View>
        <Pressable onPress={() => { setPendingProfileStart(false); setProfileDraft(profile); setProfileOpen(true); }} style={[styles.avatar, { backgroundColor: palette.primaryContainer }]}><Text style={[styles.avatarText, { color: palette.primary }]}>{profile.name ? profile.name[0].toUpperCase() : '👤'}</Text></Pressable>
        <Pressable onPress={() => void refresh()} style={styles.refresh}><Text style={{ color: palette.primary, fontSize: 22 }}>⟳</Text></Pressable>
      </View>}
    <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}><Button title="Open public map" onPress={() => flow.openPublicMap()} secondary tone="neutral" /></View>
    <CategoryTabs domain={domain} disabled={busy} onSelect={(nextDomain) => {
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
  </SafeAreaView></CategoryTheme>;
}

