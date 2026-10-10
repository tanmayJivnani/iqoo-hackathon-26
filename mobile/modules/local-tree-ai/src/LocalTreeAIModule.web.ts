import { registerWebModule, NativeModule } from 'expo';
import type { LocalAnalysis, ModelStatus } from './LocalTreeAI.types';

class LocalTreeAIModule extends NativeModule {
  getQwenStatus() { return { installed: false, modelName: 'Android only', vision: false, audio: false }; }
  async importQwenModel(): Promise<{ installed: boolean; modelName: string }> { throw new Error('Local Qwen is available on Android.'); }
  async generateQwen(): Promise<string> { throw new Error('Local Qwen is available on Android.'); }
  getModelStatus(): ModelStatus { return { installed: false, modelName: 'Android only' }; }
  async importModelFromUri(): Promise<{ installed: boolean; modelPath: string }> { throw new Error('Local Gemma import is Android only.'); }
  async analyzePhoto(): Promise<LocalAnalysis> { return { available: false, treeDetected: true }; }
}

export default registerWebModule(LocalTreeAIModule, 'LocalTreeAIModule');
