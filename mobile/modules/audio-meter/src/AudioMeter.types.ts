export type AudioMeterLiveLevel = {
  isRecording: boolean;
  durationMs: number;
  currentDbfs: number;
  currentDba: number;
  peakDbfs: number;
  peakDba: number;
};

export type AudioMeterResult = {
  uri: string;
  durationMs: number;
  sampleCount: number;
  averageDbfs: number;
  peakDbfs: number;
  averageDba: number;
  peakDba: number;
  usable: boolean;
};
