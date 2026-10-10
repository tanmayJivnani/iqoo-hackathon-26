import { colors } from '../theme';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { tabs, type CivicDomain } from '../data/civic';

export function CategoryTabs({ domain, disabled, onSelect }: {
  domain: CivicDomain;
  disabled: boolean;
  onSelect: (domain: CivicDomain) => void;
}) {
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [offset] = useState(() => new Animated.Value(0));
  const index = tabs.findIndex(tab => tab.key === domain);
  const tabWidth = Math.max(0, width - 12) / tabs.length;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; motion.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { offset.setValue(index * tabWidth); return; }
    const animation = Animated.spring(offset, {
      toValue: index * tabWidth, stiffness: 320, damping: 30, mass: 0.8,
      useNativeDriver: true, overshootClamping: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, offset, reduceMotion, tabWidth]);

  return <View style={styles.container}>
    <Text style={styles.heading}>Select the complaint category</Text>
    <View style={styles.shadow}>
      <View style={styles.pill} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && <Animated.View pointerEvents="none" style={[
          styles.selection, { width: tabWidth - 4, transform: [{ translateX: offset }] },
        ]} />}
        {tabs.map(tab => <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={tab.title}
          accessibilityState={{ selected: domain === tab.key, disabled }} disabled={disabled}
          onPress={() => onSelect(tab.key)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <Text style={styles.icon}>{tab.emoji}</Text>
          <Text style={[styles.label, domain === tab.key && styles.selectedLabel]}>{tab.title}</Text>
        </Pressable>)}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 14, gap: 10 },
  heading: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  shadow: { borderRadius: 38, boxShadow: '0 6px 22px rgba(25, 57, 42, 0.15)' },
  pill: { backgroundColor: '#FFFFFF', flexDirection: 'row', padding: 6, borderRadius: 38, overflow: 'hidden', borderWidth: 1, borderColor: '#E9EEE9' },
  selection: { position: 'absolute', left: 8, top: 6, bottom: 6, borderRadius: 30, backgroundColor: 'rgba(204,231,214,0.60)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  tab: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 30 },
  pressed: { opacity: 0.65 }, icon: { fontSize: 22 },
  label: { fontSize: 11, fontWeight: '700', color: '#53665B' }, selectedLabel: { color: colors.primary, fontWeight: '800' },
});
