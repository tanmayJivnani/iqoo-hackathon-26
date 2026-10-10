import { CameraView } from 'expo-camera';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from './ui';
import { colors } from '../theme';
import { DAYTIME_ACTIONABLE_DBA, NIGHT_ACTIONABLE_DBA } from '../lib/noise';
import { useNoiseRecording, type NoiseRecordingOptions } from '../hooks/useNoiseRecording';
export function NoiseCapture(props: NoiseRecordingOptions) {
  const { usingNative, cameraPermission, includeVideo, cameraReady, setCameraReady, camera, fallbackStatus, busy, nearSite, setNearSite, siteLabel, setSiteLabel, summary, retryMessage, liveDba, liveDbfs, recordingDurationMs, isNight, isRecordingState, finish, toggleVideo, askToRecord } = useNoiseRecording(props);
  return (
    <Card style={styles.card}>
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

      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: includeVideo }} disabled={busy || isRecordingState} onPress={() => void toggleVideo()}><Text style={styles.text}>{includeVideo ? '☑' : '☐'} Record video alongside audio for email (optional)</Text></Pressable>
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
      {summary?.video_uri && <Text style={styles.text}>Audio and video will both be attached to your report email.</Text>}

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
        <Field label="Nearby site" editable={!isRecordingState && !summary} value={siteLabel}
          onChangeText={setSiteLabel} maxLength={150} placeholder="Site name (e.g. Ruby Hall Clinic, BMCC)" />
      )}

      <Button
        disabled={busy || (!isRecordingState && includeVideo && !cameraReady) || (isRecordingState && (usingNative ? recordingDurationMs : fallbackStatus.durationMillis) < 5000)}
        onPress={() => { if (isRecordingState) void finish(); else askToRecord(); }}
        title={busy ? 'Preparing…' : isRecordingState ? 'Finish sample' : summary || retryMessage ? 'Record again' : 'Start measurement'}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cameraPreview: { height: 300, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.text },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 20, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  badge: { backgroundColor: '#E4F2E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  level: { fontSize: 36, fontWeight: '800', color: colors.primary },
  sublevel: { fontSize: 13, color: '#65736B', fontWeight: '500' },
  curfewBanner: { backgroundColor: '#F0F5F2', padding: 10, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  curfewText: { color: colors.text, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  alertBox: { backgroundColor: '#FFF4E5', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#E65100' },
  alertText: { color: '#8C3D00', fontSize: 12, lineHeight: 18 },
  text: { color: '#65736B', lineHeight: 20, fontSize: 13 },
});
