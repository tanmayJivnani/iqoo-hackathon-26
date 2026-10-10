import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AudioMeter from '../../modules/audio-meter/src';
import {
  evaluateNoiseActionability,
  summarizeLevels,
  DAYTIME_ACTIONABLE_DBA,
  NIGHT_ACTIONABLE_DBA,
  type NoiseEvidence,
} from '../lib/noise';

function isNightTimeNow(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date())
  );
  return hour >= 22 || hour < 6;
}

export function NoiseCapture({
  prepareLocation,
  onCaptured,
  initialEvidence,
}: {
  prepareLocation: () => Promise<unknown>;
  onCaptured: (evidence: NoiseEvidence | null) => void;
  initialEvidence: NoiseEvidence | null;
}) {
  const hasNativeMeter = AudioMeter != null && typeof AudioMeter.isAvailable === 'function' && AudioMeter.isAvailable();
  const [usingNative, setUsingNative] = useState(hasNativeMeter);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [includeVideo, setIncludeVideo] = useState(Boolean(initialEvidence?.video_uri));
  const [cameraReady, setCameraReady] = useState(false);
  const camera = useRef<CameraView>(null);
  const videoCamera = useRef<CameraView | null>(null);
  const videoCapture = useRef<Promise<{ uri?: string; error?: string }> | null>(null);

  // Fallback recorder for non-native environments
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 64_000,
    isMeteringEnabled: true,
  });
  const fallbackStatus = useAudioRecorderState(recorder, 200);

  const fallbackSamples = useRef<number[]>([]);
  const nativePollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef('');
  const recording = useRef(false);
  const engine = useRef<'native' | 'fallback'>('fallback');
  const finishing = useRef(false);
  const guidanceOpen = useRef(false);
  const mounted = useRef(true);
  const appActive = useRef(AppState.currentState === 'active');

  const [busy, setBusy] = useState(false);
  const [nativeRecording, setNativeRecording] = useState(false);
  const [nearSite, setNearSite] = useState(initialEvidence?.near_sensitive_site || false);
  const [siteLabel, setSiteLabel] = useState(initialEvidence?.site_label || '');
  const [summary, setSummary] = useState<NoiseEvidence | null>(initialEvidence);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  // Live metering display state
  const [liveDba, setLiveDba] = useState<number | null>(initialEvidence?.average_dba ?? null);
  const [liveDbfs, setLiveDbfs] = useState<number | null>(initialEvidence?.average_dbfs ?? null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);

  async function finish() {
    if (finishing.current || !recording.current) return;
    finishing.current = true;
    setBusy(true);
    setNativeRecording(false);

    if (nativePollInterval.current) {
      clearInterval(nativePollInterval.current);
      nativePollInterval.current = null;
    }

    try {
      let evidence: NoiseEvidence;
      const video = videoCapture.current;
      videoCamera.current?.stopRecording();
      videoCapture.current = null;

      if (engine.current === 'native' && AudioMeter) {
        const res = await AudioMeter.stopRecording();
        recording.current = false;
        if (!mounted.current || !appActive.current) return;
        if (res.durationMs < 5000) throw new Error('Record at least five seconds before preparing the notice.');

        evidence = {
          uri: res.uri,
          captured_at: startedAt.current,
          duration_ms: Math.min(res.durationMs, 30_000),
          average_dbfs: res.averageDbfs,
          peak_dbfs: res.peakDbfs,
          average_dba: res.averageDba,
          peak_dba: res.peakDba,
          sample_count: res.sampleCount,
          unit: 'dBFS',
          near_sensitive_site: nearSite,
          site_label: siteLabel.trim() || undefined,
          measurement_method: 'KOTLIN_AUDIO_RECORD_A_WEIGHTED',
        };
      } else {
        const duration = fallbackStatus.durationMillis;
        await recorder.stop();
        recording.current = false;
        if (!mounted.current || !appActive.current) return;
        if (duration < 5000 || !recorder.uri) throw new Error('Record at least five seconds before preparing the notice.');

        evidence = {
          uri: recorder.uri,
          captured_at: startedAt.current,
          duration_ms: Math.min(duration, 30_000),
          ...summarizeLevels(fallbackSamples.current),
          near_sensitive_site: nearSite,
          site_label: siteLabel.trim() || undefined,
          measurement_method: 'EXPO_AUDIO_METERED',
        };
      }
      if (video) {
        const result = await video;
        if (!mounted.current || !appActive.current) return;
        if (!result.uri) throw new Error(result.error || 'Video capture failed. Please record again or use audio only.');
        evidence.video_uri = result.uri;
      }

      // Actionability & decibel restriction check
      const captureHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date(startedAt.current)));
      const isNight = captureHour >= 22 || captureHour < 6;
      const actionCheck = evaluateNoiseActionability(evidence, isNight, nearSite);

      if (!actionCheck.actionable) {
        setSummary(null);
        onCaptured(null);
        setRetryMessage(actionCheck.reason || 'Please record again.');
        Alert.alert('Please re-record', actionCheck.reason);
        return;
      }

      setSummary(evidence);
      onCaptured(evidence);
    } catch (error) {
      videoCamera.current?.stopRecording(); videoCapture.current = null;
      recording.current = false;
      if (engine.current === 'native' && AudioMeter) void AudioMeter.cancelRecording().catch(() => undefined);
      if (!mounted.current) return;
      setSummary(null); onCaptured(null);
      Alert.alert('Recording incomplete', error instanceof Error ? error.message : 'Please retry.');
    } finally {
      finishing.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  // Handle fallback metering updates
  useEffect(() => {
    if (usingNative || !fallbackStatus.isRecording) return;
    if (fallbackStatus.metering != null) {
      fallbackSamples.current.push(fallbackStatus.metering);
    }
    if (fallbackStatus.durationMillis >= 10_000) {
      const timeout = setTimeout(() => void finish(), 0);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackStatus.durationMillis, fallbackStatus.isRecording, fallbackStatus.metering, usingNative]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      appActive.current = state === 'active';
      if (state !== 'active' && recording.current) {
        videoCamera.current?.stopRecording(); videoCapture.current = null;
        recording.current = false;
        setNativeRecording(false);
        if (engine.current === 'native' && AudioMeter) {
          void AudioMeter.cancelRecording().catch(() => undefined);
        } else {
          void recorder.stop().catch(() => undefined);
        }
        if (nativePollInterval.current) {
          clearInterval(nativePollInterval.current);
          nativePollInterval.current = null;
        }
        fallbackSamples.current = [];
        setSummary(null);
        onCaptured(null);
        Alert.alert('Recording interrupted', 'Keep the app open while capturing a noise sample.');
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      if (nativePollInterval.current) clearInterval(nativePollInterval.current);
      if (recording.current) {
        videoCamera.current?.stopRecording(); videoCapture.current = null;
        recording.current = false;
        if (engine.current === 'native' && AudioMeter) void AudioMeter.cancelRecording().catch(() => undefined);
        else void recorder.stop().catch(() => undefined);
      }
    };
  }, [recorder, onCaptured]);

  async function start() {
    if (busy || recording.current) return;
    setBusy(true);
    setSummary(null);
    setRetryMessage(null);
    onCaptured(null);

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mounted.current || !appActive.current) return;
      if (!permission.granted) throw new Error('Allow microphone access to capture noise evidence.');
      if (!(await prepareLocation())) return;
      if (!mounted.current || !appActive.current) return;

      startedAt.current = new Date().toISOString();
      const nativeAvailable = AudioMeter != null && AudioMeter.isAvailable();
      if (includeVideo && (!nativeAvailable || !cameraReady || !camera.current)) throw new Error('Wait for the Android video preview to be ready before recording.');
      setUsingNative(nativeAvailable);
      engine.current = nativeAvailable ? 'native' : 'fallback';
      setLiveDba(null); setLiveDbfs(null); setRecordingDurationMs(0);

      if (nativeAvailable && AudioMeter) {
        await AudioMeter.startRecording();
        if (!mounted.current || !appActive.current) { await AudioMeter.cancelRecording(); return; }
        recording.current = true;
        if (includeVideo && camera.current) {
          videoCamera.current = camera.current;
          videoCapture.current = camera.current.recordAsync({ maxDuration: 12, maxFileSize: 7 * 1024 * 1024 }).then(result => ({ uri: result?.uri }), error => ({ error: error instanceof Error ? error.message : 'Video recording failed.' }));
        }
        setNativeRecording(true);
        setRecordingDurationMs(0);

        const meter = AudioMeter;
        nativePollInterval.current = setInterval(() => {
          if (!recording.current || !mounted.current || !meter) return;
          const level = meter.getCurrentLevel();
          if (!level.isRecording) { void finish(); return; }
          setLiveDbfs(level.currentDbfs);
          setLiveDba(level.currentDba);
          setRecordingDurationMs(level.durationMs);
          if (level.durationMs >= 10_000) {
            void finish();
          }
        }, 150);
      } else {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!mounted.current || !appActive.current) return;
        fallbackSamples.current = [];
        recorder.record();
        recording.current = true;
      }
    } catch (error) {
      recording.current = false;
      videoCamera.current?.stopRecording(); videoCapture.current = null;
      if (engine.current === 'native' && AudioMeter) void AudioMeter.cancelRecording().catch(() => undefined);
      Alert.alert('Could not record', error instanceof Error ? error.message : 'Please retry.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function askToRecord() {
    if (busy || recording.current || guidanceOpen.current) return;
    guidanceOpen.current = true;
    Alert.alert(
      'Point toward the noise',
      'Point your phone’s microphone toward the noise source and keep it uncovered. Stay in a safe place and hold the phone steady for the 10-second recording.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { guidanceOpen.current = false; } },
        { text: 'Start recording', onPress: () => { guidanceOpen.current = false; if (mounted.current && appActive.current) void start(); } },
      ],
      { cancelable: true, onDismiss: () => { guidanceOpen.current = false; } }
    );
  }

  const isRecordingState = nativeRecording || fallbackStatus.isRecording;
  const isNight = isNightTimeNow();

  async function toggleVideo() {
    if (busy || nativeRecording || fallbackStatus.isRecording) return;
    if (!includeVideo && !cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!mounted.current) return;
      if (!result.granted) { Alert.alert('Camera access needed', 'Allow camera access to add video, or continue with audio only.'); return; }
    }
    setCameraReady(false); setIncludeVideo(value => !value);
    setSummary(null); onCaptured(null); setRetryMessage(null);
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {isRecordingState ? 'Measuring noise…' : summary ? 'Audio evidence captured' : 'Capture 10-second noise sample'}
        </Text>
        {usingNative && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>A-weighted (Kotlin)</Text>
          </View>
        )}
      </View>

      <Text style={styles.level}>
        {isRecordingState && liveDba != null
          ? `~${liveDba.toFixed(1)} dB(A)`
          : summary && summary.average_dba != null
          ? `~${summary.average_dba.toFixed(1)} dB(A)`
          : !usingNative && fallbackStatus.isRecording && fallbackStatus.metering != null
          ? `${fallbackStatus.metering.toFixed(1)} dBFS`
          : summary ? `${summary.average_dbfs.toFixed(1)} dBFS`
          : '🎙️'}
      </Text>

      {liveDbfs != null && (
        <Text style={styles.sublevel}>
          {summary
            ? `Digital peak: ${summary.peak_dbfs.toFixed(1)} dBFS`
            : `Live digital level: ${liveDbfs.toFixed(1)} dBFS`}
        </Text>
      )}

      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: includeVideo }} disabled={busy || isRecordingState} onPress={() => void toggleVideo()}><Text style={styles.text}>{includeVideo ? '☑' : '☐'} Record video alongside audio (optional)</Text></Pressable>
      {includeVideo && cameraPermission?.granted && <>
        <View style={styles.cameraPreview}><CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="video" mute videoQuality="480p" videoBitrate={1_500_000} onCameraReady={() => setCameraReady(true)} onMountError={() => { setCameraReady(false); Alert.alert('Camera unavailable', 'Please disable video and record audio only, or retry.'); }} /></View>
        <Text style={styles.text}>{summary?.video_uri ? 'Video and audio captured.' : cameraReady ? 'Video ready. Point the camera toward the noise source.' : 'Starting camera…'} Video and audio are saved as separate attachments.</Text>
      </>}

      {isNight && (
        <View style={styles.curfewBanner}>
          <Text style={styles.curfewText}>
            🌙 Night curfew active (10 PM–6 AM): Loudspeakers are restricted under Rule 5.
          </Text>
        </View>
      )}
      <Text style={styles.text}>To prepare a complaint, the estimated average must exceed {isNight ? NIGHT_ACTIONABLE_DBA : DAYTIME_ACTIONABLE_DBA} dB(A). At or below the limit, record again. This is an approximate app filter.</Text>
      <Text style={styles.text}>{usingNative ? 'Estimated A-weighted level using an assumed microphone offset. This phone is not calibrated; the reading cannot establish a legal threshold breach.' : 'Digital microphone level only. dBFS is not dB(A) and cannot be compared with residential limits.'}</Text>
      <Text style={styles.text}>Point your microphone toward the noise source and keep it uncovered.</Text>
      {summary?.video_uri && <Text style={styles.text}>Video and audio captured as separate evidence attachments.</Text>}

      {retryMessage && (
        <View style={styles.alertBox}>
          <Text accessibilityRole="alert" style={styles.alertText}>
            ⚠️ {retryMessage}
          </Text>
        </View>
      )}

      <Text style={styles.text}>
        {isRecordingState
          ? `${((usingNative ? recordingDurationMs : fallbackStatus.durationMillis) / 1000).toFixed(1)} / 10 seconds`
          : summary
          ? `Recorded ${(summary.duration_ms / 1000).toFixed(1)}s sample. Bound to timestamp and GPS.`
          : 'Hold phone steady. Audio, timestamp, and location will be attached to the police dispatch.'}
      </Text>

      <Pressable
        disabled={busy || isRecordingState || Boolean(summary)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: nearSite }}
        onPress={() => setNearSite(value => !value)}
      >
        <Text style={styles.text}>
          {nearSite ? '☑' : '☐'} Near a hospital, school or similar site (your observation)
        </Text>
      </Pressable>

      {nearSite && (
        <TextInput
          editable={!isRecordingState && !summary}
          value={siteLabel}
          onChangeText={setSiteLabel}
          maxLength={150}
          placeholder="Site name (e.g. Ruby Hall Clinic, BMCC)"
          style={styles.input}
        />
      )}

      <Pressable
        accessibilityRole="button"
        disabled={busy || (!isRecordingState && includeVideo && !cameraReady) || (isRecordingState && (usingNative ? recordingDurationMs : fallbackStatus.durationMillis) < 5000)}
        onPress={() => {
          if (isRecordingState) void finish();
          else askToRecord();
        }}
        style={[styles.button, busy && { opacity: 0.5 }]}
      >
        <Text style={styles.buttonText}>
          {busy
            ? 'Preparing…'
            : isRecordingState
            ? 'Finish sample'
            : summary || retryMessage
            ? 'Record again'
            : 'Start measurement'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraPreview: { height: 300, borderRadius: 12, overflow: 'hidden', backgroundColor: '#19392A' },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: '#19392A', flex: 1 },
  badge: { backgroundColor: '#E4F2E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#246B45', fontSize: 11, fontWeight: '700' },
  level: { fontSize: 36, fontWeight: '800', color: '#246B45' },
  sublevel: { fontSize: 13, color: '#65736B', fontWeight: '500' },
  curfewBanner: { backgroundColor: '#F0F5F2', padding: 10, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#246B45' },
  curfewText: { color: '#19392A', fontSize: 12, fontWeight: '600', lineHeight: 16 },
  alertBox: { backgroundColor: '#FFF4E5', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#E65100' },
  alertText: { color: '#8C3D00', fontSize: 12, lineHeight: 18 },
  text: { color: '#65736B', lineHeight: 20, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#DCE5DF', borderRadius: 12, padding: 12 },
  button: { backgroundColor: '#246B45', padding: 16, borderRadius: 14 },
  buttonText: { color: 'white', fontWeight: '700', textAlign: 'center', fontSize: 15 },
});
