import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as DocumentPicker from 'expo-document-picker';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import LocalTreeAI from '../../modules/local-tree-ai/src/LocalTreeAIModule';
import { localTextPrompt, parseLocalText, type AiMode } from '../lib/local-qwen';

export function useLocalAI() {
  const [mode, setMode] = useState<AiMode>('CLOUD');
  const [installed, setInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const preferenceBusy = useRef(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await SecureStore.getItemAsync('ai-provider');
        const status = LocalTreeAI.getQwenStatus();
        const ready = status.installed && status.modelName.startsWith('Qwen3.5-4B');
        if (active) { setInstalled(ready); setMode(ready && saved !== 'CLOUD' ? 'LOCAL_QWEN_35' : 'CLOUD'); }
      } catch { /* Older native builds remain usable with Cloud until rebuilt. */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  async function select(next: AiMode) {
    if (loading || importing || preferenceBusy.current) return;
    preferenceBusy.current = true;
    try { await SecureStore.setItemAsync('ai-provider', next); setMode(next); }
    catch { Alert.alert('AI preference not saved', 'Please retry.'); }
    finally { preferenceBusy.current = false; }
  }
  async function importModel() {
    if (importing) return;
    setImporting(true);
    try {
      if (!LocalTreeAI.getQwenStatus().modelName.startsWith('Qwen3.5-4B')) throw new Error('Install the updated Android build with Qwen3.5 support before importing files.');
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: false, multiple: false });
      if (result.canceled) return;
      if (!result.assets[0].name.toLowerCase().endsWith('.gguf') || !result.assets[0].name.toLowerCase().includes('qwen3.5-4b') || result.assets[0].name.toLowerCase().includes('mmproj')) throw new Error('Choose the Qwen3.5-4B model GGUF first.');
      const projector = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: false, multiple: false });
      if (projector.canceled) return;
      if (!projector.assets[0].name.toLowerCase().endsWith('.gguf') || !projector.assets[0].name.toLowerCase().includes('mmproj')) throw new Error('Choose the matching Qwen3.5 mmproj GGUF.');
      const status = await LocalTreeAI.importQwenModel(result.assets[0].uri, projector.assets[0].uri);
      setInstalled(status.installed);
      await SecureStore.setItemAsync('ai-provider', 'LOCAL_QWEN_35'); setMode('LOCAL_QWEN_35');
      Alert.alert('Qwen3.5 files imported', 'The model and projector are saved. Their image capabilities are checked when analysis starts. Keep the app open during inference.');
    } catch (error) { Alert.alert('Model not imported', error instanceof Error ? error.message : 'Rebuild the app with GenieX support, then import the GGUF file.'); }
    finally { setImporting(false); }
  }
  async function summarize(context: Record<string, unknown>, verification = false, media: { imageUris?: string[] } = {}) {
    if (loading || importing) throw new Error('Wait for AI settings to finish loading or importing.');
    const status = LocalTreeAI.getQwenStatus();
    if (!status.modelName.startsWith('Qwen3.5-4B')) throw new Error('Install the updated Android build with Qwen3.5 support.');
    if (!status.installed) throw new Error('Import Qwen3.5 and its matching mmproj in AI settings before choosing local inference.');
    const images = media.imageUris || [];
    const tag = 'qwen35-inference';
    await activateKeepAwakeAsync(tag);
    try { return parseLocalText(await LocalTreeAI.generateQwen(localTextPrompt(context, verification, { images: images.length }), images, null)); }
    finally { await deactivateKeepAwake(tag); }
  }
  return { mode, installed, loading, importing, select, importModel, summarize };
}
export type LocalAISettings = ReturnType<typeof useLocalAI>;
