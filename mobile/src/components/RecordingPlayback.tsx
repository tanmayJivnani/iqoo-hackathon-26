import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

function playbackSource(remoteUri?: string, localUri?: string) {
  if (localUri) {
    try { if (new File(localUri).exists) return localUri; } catch { /* Use the saved server recording. */ }
  }
  return remoteUri || null;
}
function timeLabel(seconds: number) {
  const total = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function RecordingPlayback({ audioUri, videoUri, localAudioUri, localVideoUri, disabled }: {
  audioUri?: string; videoUri?: string; localAudioUri?: string; localVideoUri?: string; disabled: boolean;
}) {
  const audioSource = useMemo(() => playbackSource(audioUri, localAudioUri), [audioUri, localAudioUri]);
  const videoSource = useMemo(() => playbackSource(videoUri, localVideoUri), [videoUri, localVideoUri]);
  const audio = useAudioPlayer(audioSource, { updateInterval: 200 });
  const audioStatus = useAudioPlayerStatus(audio);
  const video = useVideoPlayer(videoSource);
  const { status: videoStatus, error: videoError } = useEvent(video, 'statusChange', { status: video.status });
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioStarting, setAudioStarting] = useState(false);

  useEventListener(audio, 'playbackStatusUpdate', status => {
    if ('error' in status && status.error) setAudioError('Audio could not be played. Retry when the backend is connected.');
  });
  useEventListener(video, 'playingChange', ({ isPlaying }) => { if (isPlaying) audio.pause(); });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { audio.pause(); video.pause(); }
    });
    return () => subscription.remove();
  }, [audio, video]);
  useEffect(() => {
    if (disabled) { audio.pause(); video.pause(); }
  }, [disabled, audio, video]);

  async function playAudio(replay = false) {
    if (disabled || audioStarting) return;
    if (audioStatus.playing && !replay) { audio.pause(); return; }
    setAudioStarting(true);
    setAudioError(null);
    try {
      video.pause();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
      if (replay || audioStatus.didJustFinish || (audioStatus.duration > 0 && audioStatus.currentTime >= audioStatus.duration)) await audio.seekTo(0);
      if (AppState.currentState === 'active') audio.play();
    } catch {
      setAudioError('Audio could not be played. Please retry.');
    } finally { setAudioStarting(false); }
  }

  return <View style={styles.card}>
    <Text style={styles.heading}>Review recordings</Text>
    {audioSource && <View style={styles.section}>
      <Text style={styles.label}>Audio recording</Text>
      <Text style={styles.caption}>{timeLabel(audioStatus.currentTime)} / {timeLabel(audioStatus.duration)}</Text>
      {(!audioStatus.isLoaded || audioStatus.isBuffering) && !audioError && <Text style={styles.caption}>Loading audio…</Text>}
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" disabled={disabled || audioStarting || !audioStatus.isLoaded}
          accessibilityLabel={audioStatus.playing ? 'Pause audio recording' : 'Play audio recording'}
          onPress={() => void playAudio()} style={[styles.button, (disabled || !audioStatus.isLoaded) && styles.disabled]}>
          <Text style={styles.buttonText}>{audioStatus.playing ? 'Pause audio' : 'Play audio'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || audioStarting || !audioStatus.isLoaded}
          onPress={() => void playAudio(true)} style={[styles.secondary, (disabled || !audioStatus.isLoaded) && styles.disabled]}>
          <Text style={styles.secondaryText}>Replay</Text>
        </Pressable>
      </View>
      {audioError && <>
        <Text accessibilityRole="alert" style={styles.error}>{audioError}</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { setAudioError(null); audio.replace(audioSource); }} style={styles.secondary}>
          <Text style={styles.secondaryText}>Reload audio</Text>
        </Pressable>
      </>}
    </View>}
    {videoSource && <View style={styles.section}>
      <Text style={styles.label}>Video recording</Text>
      <View pointerEvents={disabled ? 'none' : 'auto'} style={styles.videoFrame}>
        <VideoView player={video} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
      </View>
      <Text style={styles.caption}>This video is silent. Listen to the audio recording separately.</Text>
      {videoStatus === 'loading' && <Text style={styles.caption}>Loading video…</Text>}
      {(videoStatus === 'error' || videoError) && <>
        <Text accessibilityRole="alert" style={styles.error}>Video could not be played. Retry when the backend is connected.</Text>
        <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void video.replaceAsync(videoSource).catch(() => undefined)} style={styles.secondary}>
          <Text style={styles.secondaryText}>Reload video</Text>
        </Pressable>
      </>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E9EEE9', padding: 16, gap: 16 },
  heading: { color: '#246B45', fontWeight: '800', fontSize: 15 },
  section: { gap: 9 }, label: { color: '#19392A', fontSize: 14, fontWeight: '700' },
  caption: { color: '#738078', fontSize: 13, lineHeight: 20 },
  controls: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#246B45', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  secondary: { minHeight: 46, borderRadius: 12, backgroundColor: '#E8F0EA', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { color: '#246B45', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.5 },
  videoFrame: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#000000' },
  video: { width: '100%', height: 240 },
  error: { color: '#B84D40', fontSize: 13, lineHeight: 20 },
});
