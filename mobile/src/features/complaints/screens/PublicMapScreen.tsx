import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Button, Card, PageHeader } from '../../../components/ui';
import { API_BASE } from '../../../lib/api';
import { colors } from '../../../theme';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';

const mapUrl = `${API_BASE}/`;
const backendOrigin = new URL(mapUrl).origin;

export function PublicMapScreen({ setPage }: Pick<ComplaintFlow, 'setPage'>) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
    <PageHeader title="Public map" onBack={() => setPage('tracker')} />
    {failed ? <View style={styles.error}>
      <Card>
        <Text style={styles.errorTitle}>Map unavailable</Text>
        <Text style={styles.errorText}>Check that the backend is running and your phone is connected, then try again.</Text>
        <Button title="Retry" onPress={() => { setFailed(false); setAttempt(value => value + 1); }} />
      </Card>
    </View> : <WebView
      key={attempt}
      source={{ uri: mapUrl }}
      style={styles.webview}
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={request => {
        if (request.url === 'about:blank') return true;
        try { return new URL(request.url).origin === backendOrigin; }
        catch { return false; }
      }}
      setSupportMultipleWindows={false}
      startInLoadingState
      renderLoading={() => <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>}
      onError={() => setFailed(true)}
      onHttpError={event => {
        if (event.nativeEvent.url.replace(/\/$/, '') === API_BASE && event.nativeEvent.statusCode >= 400) setFailed(true);
      }}
    />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  webview: { flex: 1, backgroundColor: colors.canvas },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  error: { flex: 1, padding: 20, justifyContent: 'center' },
  errorTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  errorText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
