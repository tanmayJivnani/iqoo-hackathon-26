import { NativeModule, requireNativeModule } from 'expo';
import type { LocalAnalysis, ModelStatus } from './LocalTreeAI.types';

declare class LocalTreeAIModule extends NativeModule {
  getModelStatus(): ModelStatus;
  importModelFromUri(uri: string): Promise<{ installed: boolean; modelPath: string }>;
  analyzePhoto(uri: string, category: string, address: string): Promise<LocalAnalysis>;
}

export default requireNativeModule<LocalTreeAIModule>('LocalTreeAI');
