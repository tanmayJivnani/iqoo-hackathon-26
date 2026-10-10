import { NativeModule, requireNativeModule } from 'expo';
import type { AudioMeterLiveLevel, AudioMeterResult } from './AudioMeter.types';

declare class AudioMeterNativeModule extends NativeModule {
  isAvailable(): boolean;
  startRecording(): Promise<{ started: boolean; sampleRate: number }>;
  getCurrentLevel(): AudioMeterLiveLevel;
  stopRecording(): Promise<AudioMeterResult>;
  cancelRecording(): Promise<boolean>;
}

let nativeModule: AudioMeterNativeModule | null = null;
try {
  nativeModule = requireNativeModule<AudioMeterNativeModule>('AudioMeter');
} catch {
  nativeModule = null;
}

export default nativeModule;
