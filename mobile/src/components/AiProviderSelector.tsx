import { Pressable, Text, View } from 'react-native';
import tw from 'twrnc';
import type { LocalAISettings } from '../hooks/useLocalAI';
export function AiProviderSelector({ settings, disabled = false }: { settings: LocalAISettings; disabled?: boolean }) {
  const blocked = disabled || settings.loading || settings.importing;
  return <View style={tw`bg-white border border-[#E9EEE9] rounded-2xl p-4`}>
    <Text style={tw`text-[#246B45] text-sm font-bold mb-2`}>AI model</Text>
    <View style={tw`flex-row`}>
      {([{ mode: 'CLOUD', label: 'Cloud AI' }, { mode: 'LOCAL_QWEN_35', label: 'Local Qwen3.5' }] as const).map(option => <Pressable key={option.mode}
        accessibilityRole="radio" accessibilityState={{ checked: settings.mode === option.mode, disabled: blocked || (option.mode === 'LOCAL_QWEN_35' && !settings.installed) }}
        disabled={blocked || (option.mode === 'LOCAL_QWEN_35' && !settings.installed)} onPress={() => void settings.select(option.mode)}
        style={[tw`flex-1 rounded-full py-3 px-3 items-center mr-2`, settings.mode === option.mode ? tw`bg-[#246B45]` : tw`bg-[#E8F0EA]`]}>
        <Text style={[tw`text-sm font-bold`, settings.mode === option.mode ? tw`text-white` : tw`text-[#246B45]`]}>{option.label}</Text>
      </Pressable>)}
    </View>
    <Text style={tw`text-xs text-[#738078] mt-2 leading-5`}>{settings.mode === 'LOCAL_QWEN_35'
      ? 'Qwen3.5-4B analyzes photos on this phone. Noise recordings are not analyzed; only measured dB levels are used. Audio and video remain attached for authority review. Keep the app open during photo analysis; thinking is disabled for faster responses.'
      : 'Cloud models analyze the evidence photos. Your choice is saved for future reports.'}</Text>
    <Pressable accessibilityRole="button" disabled={blocked} onPress={() => void settings.importModel()} style={tw`mt-3 py-2`}>
      <Text style={tw`text-sm text-[#246B45] font-bold`}>{settings.importing ? 'Importing model…' : settings.installed ? 'Replace local model files' : 'Import Qwen3.5-4B + projector'}</Text>
    </Pressable>
    {settings.installed && <Text style={tw`text-xs text-[#738078]`}>Qwen3.5-4B · model + projector installed</Text>}
  </View>;
}
