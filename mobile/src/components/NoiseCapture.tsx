import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { isUsableNoiseRecording, QUIET_RECORDING_MESSAGE, summarizeLevels, type NoiseEvidence } from '../lib/noise';

export function NoiseCapture({ prepareLocation, onCaptured, initialEvidence }: { prepareLocation: () => Promise<unknown>; onCaptured: (evidence: NoiseEvidence | null) => void; initialEvidence: NoiseEvidence | null }) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64_000, isMeteringEnabled: true });
  const status = useAudioRecorderState(recorder, 200);
  const samples = useRef<number[]>([]);
  const startedAt = useRef('');
  const recording = useRef(false);
  const finishing = useRef(false);
  const guidanceOpen = useRef(false);
  const mounted = useRef(true);
  const appActive = useRef(AppState.currentState === 'active');
  const [busy, setBusy] = useState(false);
  const [nearSite, setNearSite] = useState(initialEvidence?.near_sensitive_site || false);
  const [siteLabel, setSiteLabel] = useState(initialEvidence?.site_label || '');
  const [summary, setSummary] = useState<NoiseEvidence | null>(initialEvidence);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  async function finish() {
    if (finishing.current || !recording.current) return;
    finishing.current = true; setBusy(true);
    const duration = status.durationMillis;
    try {
      await recorder.stop(); recording.current = false;
      if (!mounted.current || !appActive.current) return;
      if (duration < 5000 || !recorder.uri) throw new Error('Record at least five seconds before preparing the notice.');
      const evidence = { uri: recorder.uri, captured_at: startedAt.current, duration_ms: Math.min(duration, 30_000), ...summarizeLevels(samples.current), near_sensitive_site: nearSite, site_label: siteLabel.trim() || undefined };
      if (!isUsableNoiseRecording(evidence)) {
        setSummary(null); onCaptured(null); setRetryMessage(QUIET_RECORDING_MESSAGE);
        Alert.alert('Please re-record', QUIET_RECORDING_MESSAGE);
        return;
      }
      setSummary(evidence); onCaptured(evidence);
    } catch (error) { Alert.alert('Recording incomplete', error instanceof Error ? error.message : 'Please retry.'); }
    finally { finishing.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!status.isRecording) return;
    if (status.metering != null) samples.current.push(status.metering);
    if (status.durationMillis >= 10_000) {
      const timeout = setTimeout(() => void finish(), 0);
      return () => clearTimeout(timeout);
    }
    // Recorder samples are consumed once for each native polling update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.durationMillis, status.isRecording, status.metering]);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      appActive.current = state === 'active';
      if (state !== 'active' && recording.current) {
        recording.current = false;
        void recorder.stop().catch(() => undefined);
        samples.current = []; setSummary(null); onCaptured(null);
        Alert.alert('Recording interrupted', 'Keep the app open while capturing a noise sample.');
      }
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, [recorder, onCaptured]);
  async function start() {
    if (busy || recording.current) return;
    setBusy(true); setSummary(null); setRetryMessage(null); onCaptured(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mounted.current || !appActive.current) return;
      if (!permission.granted) throw new Error('Allow microphone access to capture noise evidence.');
      if (!await prepareLocation()) return;
      if (!mounted.current || !appActive.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!mounted.current || !appActive.current) return;
      samples.current = []; setSummary(null); startedAt.current = new Date().toISOString();
      recorder.record(); recording.current = true;
    } catch (error) { Alert.alert('Could not record', error instanceof Error ? error.message : 'Please retry.'); }
    finally { setBusy(false); }
  }
  function askToRecord() {
    if (busy || recording.current || guidanceOpen.current) return;
    guidanceOpen.current = true;
    Alert.alert('Point toward the noise', 'Point your phone’s microphone toward the noise source and keep it uncovered. Stay in a safe place and hold the phone steady for the 10-second recording.', [
      { text: 'Cancel', style: 'cancel', onPress: () => { guidanceOpen.current = false; } },
      { text: 'Start recording', onPress: () => { guidanceOpen.current = false; if (mounted.current && appActive.current) void start(); } },
    ], { cancelable: true, onDismiss: () => { guidanceOpen.current = false; } });
  }
  return <View style={styles.card}>
    <Text style={styles.title}>{status.isRecording ? 'Listening…' : summary ? 'Audio evidence captured' : 'Capture a 10-second noise sample'}</Text>
    <Text style={styles.level}>{status.isRecording && status.metering != null ? `${status.metering.toFixed(1)} dBFS` : summary ? `${summary.average_dbfs.toFixed(1)} dBFS avg` : '🎙️'}</Text>
    <Text style={styles.text}>Uncalibrated microphone level. This is not a certified dB(A) reading or a legal threshold test.</Text>
    <Text style={styles.text}>Point your microphone toward the noise source and keep it uncovered.</Text>
    {retryMessage && <Text accessibilityRole="alert" style={styles.text}>{retryMessage}</Text>}
    <Text style={styles.text}>{status.isRecording ? `${(status.durationMillis / 1000).toFixed(1)} / 10 seconds` : summary ? `${(summary.duration_ms / 1000).toFixed(1)} seconds · peak ${summary.peak_dbfs.toFixed(1)} dBFS` : 'Audio, timestamp and GPS will accompany your complaint.'}</Text>
    <Pressable disabled={busy || status.isRecording || Boolean(summary)} accessibilityRole="checkbox" accessibilityState={{ checked: nearSite }} onPress={() => setNearSite(value => !value)}><Text style={styles.text}>{nearSite ? '☑' : '☐'} Near a hospital, school or similar site (your observation)</Text></Pressable>
    {nearSite && <TextInput editable={!status.isRecording && !summary} value={siteLabel} onChangeText={setSiteLabel} maxLength={150} placeholder="Site name (optional)" style={styles.input} />}
    <Pressable accessibilityRole="button" disabled={busy || (status.isRecording && status.durationMillis < 5000)} onPress={() => { if (status.isRecording) void finish(); else askToRecord(); }} style={[styles.button, busy && { opacity: 0.5 }]}><Text style={styles.buttonText}>{busy ? 'Preparing…' : status.isRecording ? 'Finish sample' : summary || retryMessage ? 'Record again' : 'Start recording'}</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: 'white', padding: 20, borderRadius: 20, gap: 14 }, title: { fontSize: 19, fontWeight: '700', color: '#19392A' }, level: { fontSize: 36, fontWeight: '800', color: '#246B45' }, text: { color: '#65736B', lineHeight: 20 }, input: { borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, padding: 12 }, button: { backgroundColor: '#246B45', padding: 16, borderRadius: 14 }, buttonText: { color: 'white', fontWeight: '700', textAlign: 'center' } });
