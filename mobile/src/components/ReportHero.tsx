import { colors } from '../theme';
import { BlurView } from 'expo-blur';
import { useEffect, useState, type RefObject } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { clamp, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type CivicDomain } from '../data/civic';

export function ReportHero({ domain, scrollY, compact, blurTarget, headerHidden, headerHeight, onExpandedHeight, onReport }: {
  domain: CivicDomain;
  scrollY: SharedValue<number>;
  compact: boolean;
  blurTarget: RefObject<View | null>;
  headerHidden: boolean;
  headerHeight: number;
  onExpandedHeight: (height: number) => void;
  onReport: () => void;
}) {
  const insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(headerHeight + 20);
  const [textHeight, setTextHeight] = useState(180);
  const [width, setWidth] = useState(344);
  const [reduceMotion, setReduceMotion] = useState(false);
  const expandedHeight = textHeight + 12 + 50 + 46;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const toValue = headerHidden ? 12 : headerHeight + 20;
    headerOffset.set(reduceMotion ? toValue : withDelay(headerHidden ? 120 : 0,
      withTiming(toValue, { duration: headerHidden ? 400 : 180 })));
  }, [headerHidden, headerHeight, headerOffset, reduceMotion]);

  // Scroll and geometry stay on the UI thread. The copy keeps a fixed width,
  // so shrinking the card cannot rewrap text or change the list's spacer height.
  const progress = useDerivedValue(() => {
    const t = clamp((scrollY.get() - 16) / 200, 0, 1);
    return reduceMotion ? (t >= 1 ? 1 : 0) : t * t * (3 - 2 * t);
  });
  const positionStyle = useAnimatedStyle(() => ({ transform: [{ translateY: headerOffset.get() }] }));
  const cardStyle = useAnimatedStyle(() => ({ height: expandedHeight - (expandedHeight - 44) * progress.get() }));
  const solidStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  const glassStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: clamp(1 - progress.get() * 1.6, 0, 1),
    transform: [{ translateY: -16 * progress.get() }],
  }));
  const buttonStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const compactInset = Math.max(0, (width - Math.min(width, 228)) / 2);
    const inset = 23 + (compactInset - 23) * p;
    return { left: inset, right: inset, bottom: 23 * (1 - p), height: 50 - 6 * p };
  });
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], ['#FFFFFF', colors.primary]),
    fontSize: 14 - progress.get(),
  }));

  return <Animated.View style={[
    styles.position,
    { top: insets.top + 12, left: insets.left + 20, right: insets.right + 20 }, positionStyle,
  ]} pointerEvents="box-none" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Animated.View pointerEvents="box-none" style={[styles.card, cardStyle]}>
      <Animated.View pointerEvents="none" style={[styles.solidCard, solidStyle]} />
      <Animated.View pointerEvents="none" accessibilityElementsHidden={compact}
        importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'} style={[styles.copyPosition, copyStyle]}>
        <View style={styles.copy} onLayout={event => {
          const height = event.nativeEvent.layout.height;
          setTextHeight(height);
          onExpandedHeight(height + 12 + 50 + 46);
        }}>
          <Text style={styles.eyebrow}>PUNE • {domain}</Text>
          <Text style={styles.title}>{'Capture it.\nMake it count.'}</Text>
          <Text style={styles.description}>{domain === 'NOISE'
            ? 'A short audio sample, GPS and a ready-to-send police complaint.'
            : 'One photo, GPS and a ready-to-send civic notice. No legal writing required.'}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.buttonPosition, buttonStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glassStyle]}>
          <View style={styles.glass}>
            <BlurView pointerEvents="none" blurTarget={blurTarget} blurMethod="dimezisBlurView" intensity={70} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.frost} />
          </View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.solidButton, solidStyle]} />
        <Pressable accessibilityRole="button" onPress={onReport}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[styles.buttonText, labelStyle]}>＋  Report a concern</Animated.Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute' },
  card: { borderRadius: 25, overflow: 'hidden' },
  solidCard: { ...StyleSheet.absoluteFill, backgroundColor: colors.text },
  copyPosition: { position: 'absolute', left: 23, right: 23, top: 23 },
  buttonPosition: { position: 'absolute', borderRadius: 25, overflow: 'hidden' },
  glass: { ...StyleSheet.absoluteFill, borderRadius: 25, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)' },
  frost: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(36,107,69,0.17)' },
  solidButton: { ...StyleSheet.absoluteFill, backgroundColor: colors.primary, borderRadius: 25 },
  copy: { gap: 12 }, eyebrow: { color: '#ACD6B6', fontWeight: '800', letterSpacing: 1.6, fontSize: 10 },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', lineHeight: 33 },
  description: { color: '#CFDED3', lineHeight: 21, fontSize: 14, marginBottom: 4 },
  button: { flex: 1, minHeight: 44, borderRadius: 25, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 14 }, pressed: { opacity: 0.8 },
});
