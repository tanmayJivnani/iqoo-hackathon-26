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
        if (active) { setInstalled(status.installed); setMode(saved === 'CLOUD' ? 'CLOUD' : saved === 'LOCAL_QWEN' || status.installed ? 'LOCAL_QWEN' : 'CLOUD'); }
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
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: false, multiple: false });
      if (result.canceled) return;
      if (!result.assets[0].name.toLowerCase().endsWith('.gguf')) throw new Error('Choose your Qwen GGUF file.');
      const status = await LocalTreeAI.importQwenModel(result.assets[0].uri);
      setInstalled(status.installed);
      await SecureStore.setItemAsync('ai-provider', 'LOCAL_QWEN'); setMode('LOCAL_QWEN');
      Alert.alert('Local model ready', 'Qwen runs on this phone. It can summarize your observations; it cannot inspect photos or listen to recordings.');
    } catch (error) { Alert.alert('Model not imported', error instanceof Error ? error.message : 'Rebuild the app with GenieX support, then import the GGUF file.'); }
    finally { setImporting(false); }
  }
  async function summarize(context: Record<string, unknown>, verification = false) {
    if (loading || importing) throw new Error('Wait for AI settings to finish loading or importing.');
    const status = LocalTreeAI.getQwenStatus();
    if (!status.installed) throw new Error('Import your Qwen GGUF file in AI settings before choosing local inference.');
    return parseLocalText(await LocalTreeAI.generateQwen(localTextPrompt(context, verification)));
  }
  return { mode, installed, loading, importing, select, importModel, summarize };
}
export type LocalAISettings = ReturnType<typeof useLocalAI>;
