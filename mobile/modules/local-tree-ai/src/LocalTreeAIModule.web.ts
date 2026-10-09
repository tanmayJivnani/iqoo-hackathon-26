import { registerWebModule, NativeModule } from 'expo';
import type { LocalAnalysis, ModelStatus } from './LocalTreeAI.types';

class LocalTreeAIModule extends NativeModule {
  getModelStatus(): ModelStatus { return { installed: false, modelName: 'Android only' }; }
  async importModelFromUri(): Promise<{ installed: boolean; modelPath: string }> { throw new Error('Local Gemma import is Android only.'); }
  async analyzePhoto(): Promise<LocalAnalysis> { return { available: false, treeDetected: true }; }
}

export default registerWebModule(LocalTreeAIModule, 'LocalTreeAIModule');
