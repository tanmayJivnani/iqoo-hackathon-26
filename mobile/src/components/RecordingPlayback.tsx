import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEvent, useEventListener } from 'expo';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import tw, { style as twStyle } from 'twrnc';
import { wavWaveform, waveformHeights } from '../lib/audio-waveform';

const BINS = 48;
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
  const video = useVideoPlayer(videoSource, player => {
    // The camera records silent video; the original noise recording supplies its sound.
    player.muted = Boolean(audioSource);
    player.audioMixingMode = 'mixWithOthers';
    player.timeUpdateEventInterval = 0.2;
  });
  const { status: videoStatus } = useEvent(video, 'statusChange', { status: video.status });
  const videoTime = useEvent(video, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const [wanted, setWanted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>(Array(BINS).fill(0));
  const [waveWidth, setWaveWidth] = useState(0);
  const mounted = useRef(true);
  const blocked = useRef(disabled);
  const actionInFlight = useRef(false);
  useLayoutEffect(() => { blocked.current = disabled; }, [disabled]);
  const duration = audioSource ? audioStatus.duration : video.duration;
  const position = audioSource ? audioStatus.currentTime : videoTime?.currentTime ?? 0;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  // Audio is the playback master when present; a slow or unavailable video must not block its controls.
  const ready = audioSource ? audioStatus.isLoaded : (!videoSource || videoStatus === 'readyToPlay');
  const waiting = !ready || Boolean(audioSource && audioStatus.isBuffering);
  const heights = useMemo(() => waveformHeights(peaks), [peaks]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { setWanted(false); audio.pause(); video.pause(); }
    });
    return () => { mounted.current = false; subscription.remove(); };
  }, [audio, video]);

  useEffect(() => {
    // Cancel playback intent when sharing starts, so it cannot resume when sharing finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (disabled || error) setWanted(false);
    if (!wanted || disabled || error || !ready) { audio.pause(); video.pause(); return; }
    if (audioSource) audio.play();
    else video.play();
  }, [wanted, disabled, error, ready, audioSource, audio, video]);

  useEffect(() => {
    if (!videoSource || !audioSource) return;
    // Audio is the master clock: pause together and correct drift after seeking/buffering.
    if (wanted && audioStatus.playing && !audioStatus.isBuffering && videoStatus === 'readyToPlay') {
      if (Math.abs(video.currentTime - audioStatus.currentTime) > 0.3) video.seekBy(audioStatus.currentTime - video.currentTime);
      if (!video.playing) video.play();
    } else video.pause();
  }, [wanted, audioStatus.playing, audioStatus.isBuffering, audioStatus.currentTime, videoStatus, audioSource, videoSource, video]);

  useEventListener(video, 'playToEnd', () => { setWanted(false); audio.pause(); });
  useEventListener(video, 'statusChange', ({ status, error: videoError }) => {
    if ((status === 'error' || videoError) && !audioSource) setError('Recording could not be played. Reconnect and reload.');
  });
  useEventListener(audio, 'playbackStatusUpdate', status => {
    if (status.didJustFinish) { setWanted(false); video.pause(); }
    if ('error' in status && status.error) setError('Recording could not be played. Reconnect and reload.');
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!audioSource) return;
    // Use one decoded waveform for the recording. Playback changes only its progress color.
    // Compressed formats keep a neutral baseline when PCM peaks are unavailable.
    void (async () => {
      const bytes = audioSource.startsWith('file:')
        ? await new File(audioSource).bytes()
        : await (async () => {
          const response = await fetch(audioSource, { signal: controller.signal });
          if (!response.ok) throw new Error('Waveform unavailable');
          return new Uint8Array(await response.arrayBuffer());
        })();
      const waveform = wavWaveform(bytes, BINS);
      if (!cancelled) setPeaks(waveform ?? Array(BINS).fill(0));
    })().catch(() => undefined);
    return () => { cancelled = true; controller.abort(); };
  }, [audioSource]);

  async function seek(seconds: number, resume = wanted) {
    if (blocked.current || actionInFlight.current || !ready) return;
    actionInFlight.current = true; setWorking(true); setWanted(false);
    audio.pause(); video.pause();
    try {
      if (audioSource) await audio.seekTo(seconds);
      if (!mounted.current || blocked.current) return;
      if (videoSource) video.seekBy(seconds - video.currentTime);
      if (AppState.currentState === 'active') setWanted(resume);
    } catch { if (mounted.current) setError('Could not seek. Please reload the recording.'); }
    finally { actionInFlight.current = false; if (mounted.current) setWorking(false); }
  }

  async function toggle() {
    if (blocked.current || actionInFlight.current || !ready) return;
    if (wanted) { setWanted(false); audio.pause(); video.pause(); return; }
    actionInFlight.current = true; setWorking(true);
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
      if (!mounted.current || blocked.current || AppState.currentState !== 'active') return;
      if ((duration > 0 && position >= duration - 0.1) || audioStatus.didJustFinish) {
        if (audioSource) await audio.seekTo(0);
        if (!mounted.current || blocked.current) return;
        if (videoSource) { video.replay(); video.pause(); }
      }
      if (AppState.currentState === 'active') setWanted(true);
    } catch { if (mounted.current) setError('Recording could not be played. Please reload.'); }
    finally { actionInFlight.current = false; if (mounted.current) setWorking(false); }
  }

  async function reload() {
    setWanted(false); setError(null); audio.pause(); video.pause();
    try {
      if (audioSource) audio.replace(audioSource);
      if (videoSource) await video.replaceAsync(videoSource);
    } catch { if (mounted.current) setError('Recording could not be loaded. Reconnect and retry.'); }
  }

  if (!audioSource && !videoSource) return null;
  return <View style={tw`bg-white rounded-2xl border border-[#E9EEE9] p-4`}>
    <Text style={tw`text-[#246B45] text-sm font-bold mb-3`}>{videoSource ? 'Video with audio' : 'Audio recording'}</Text>
    {videoSource && <View style={tw`rounded-xl overflow-hidden bg-black mb-3`}>
      <VideoView player={video} style={tw`w-full h-60`} nativeControls={false} contentFit="contain" />
    </View>}
    <View style={twStyle('flex-row items-center rounded-full bg-[#E8F0EA] p-2', (disabled || working) && 'opacity-50')}>
      <Pressable accessibilityRole="button" accessibilityLabel={wanted ? 'Pause recording' : 'Play recording'}
        disabled={disabled || working || !ready || Boolean(error)} onPress={() => void toggle()}
        style={tw`w-12 h-12 rounded-full bg-[#246B45] items-center justify-center`}>
        {waiting && !error ? <ActivityIndicator color="white" /> : <MaterialCommunityIcons name={wanted ? 'pause' : 'play'} size={28} color="white" />}
      </Pressable>
      <Pressable accessibilityRole="adjustable" accessibilityLabel="Recording waveform. Tap to seek"
        accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: `${timeLabel(position)} of ${timeLabel(duration)}` }}
        accessibilityActions={[{ name: 'increment', label: 'Forward five seconds' }, { name: 'decrement', label: 'Back five seconds' }]}
        onAccessibilityAction={({ nativeEvent }) => void seek(Math.max(0, Math.min(duration, position + (nativeEvent.actionName === 'increment' ? 5 : -5))))}
        disabled={disabled || working || !ready || Boolean(error)}
        onLayout={({ nativeEvent }) => setWaveWidth(nativeEvent.layout.width)}
        onPress={({ nativeEvent }) => { if (waveWidth > 0) void seek(Math.max(0, Math.min(0.999, nativeEvent.locationX / waveWidth)) * duration); }}
        style={tw`flex-1 h-12 ml-3 mr-2 flex-row items-center justify-between overflow-hidden`}>
        {heights.map((height, index) => <View key={index} pointerEvents="none"
          style={twStyle('rounded-full', index / BINS < progress ? 'bg-[#246B45]' : 'bg-[#A4BDAA]', { height, width: Math.max(2, waveWidth / BINS - 2) })} />)}
      </Pressable>
    </View>
    <View style={tw`flex-row items-center justify-between mt-2`}>
      <Text style={tw`text-xs text-[#738078]`}>{timeLabel(position)} / {timeLabel(duration)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Replay recording" disabled={disabled || working || !ready || Boolean(error)}
        onPress={() => void seek(0, true)} style={tw`min-h-[44px] px-3 justify-center`}>
        <Text style={tw`text-xs font-bold text-[#246B45]`}>Replay</Text>
      </Pressable>
    </View>
    {error && <View>
      <Text accessibilityRole="alert" style={tw`text-sm text-[#B84D40]`}>{error}</Text>
      <Pressable accessibilityRole="button" disabled={disabled || working} onPress={() => void reload()} style={tw`min-h-[44px] justify-center`}>
        <Text style={tw`text-sm font-bold text-[#246B45]`}>Reload recording</Text>
      </Pressable>
    </View>}
  </View>;
}
