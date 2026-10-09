import { registerWebModule, NativeModule } from 'expo';
import type { AudioMeterLiveLevel, AudioMeterResult } from './AudioMeter.types';

class AudioMeterWebModule extends NativeModule {
  isAvailable(): boolean {
    return false;
  }
  async startRecording(): Promise<{ started: boolean; sampleRate: number }> {
    throw new Error('AudioMeter is Android only.');
  }
  getCurrentLevel(): AudioMeterLiveLevel {
    return {
      isRecording: false,
      durationMs: 0,
      currentDbfs: -160,
      currentDba: 0,
      peakDbfs: -160,
      peakDba: 0,
    };
  }
  async stopRecording(): Promise<AudioMeterResult> {
    throw new Error('AudioMeter is Android only.');
  }
  cancelRecording(): boolean {
    return false;
  }
}

export default registerWebModule(AudioMeterWebModule, 'AudioMeter');
