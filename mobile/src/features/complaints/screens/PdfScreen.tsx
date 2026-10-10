import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, PageHeader } from '../../../components/ui';
import { API_BASE } from '../../../lib/api';
import { colors } from '../../../theme';

export function PdfScreen({ complaintId, onBack }: { complaintId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <View style={{ flex: 1, paddingBottom: insets.bottom }}>
    <PageHeader title="Report PDF" onBack={onBack} />
    {failed ? <View style={{ padding: 24, gap: 16 }}>
      <Text style={{ color: colors.text }}>Could not open the PDF. Check the backend connection and retry.</Text>
      <Button title="Retry" onPress={() => { setFailed(false); setAttempt(value => value + 1); }} />
    </View> : <WebView key={attempt}
      source={{ uri: `${API_BASE}/api/v1/complaints/${encodeURIComponent(complaintId)}/view-pdf` }}
      style={{ flex: 1, backgroundColor: colors.canvas }} startInLoadingState
      renderLoading={() => <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />}
      onError={() => setFailed(true)} onHttpError={event => { if (event.nativeEvent.url.endsWith('/view-pdf')) setFailed(true); }}
      originWhitelist={['*']} setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith(`${API_BASE}/`)}
    />}
  </View>;
}
