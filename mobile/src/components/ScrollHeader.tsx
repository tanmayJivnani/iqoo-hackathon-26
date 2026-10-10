import { BlurView } from 'expo-blur';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ScrollHeader({ hidden, height, blurTarget, onHeight, children }: {
  hidden: boolean;
  height: number;
  blurTarget: RefObject<View | null>;
  onHeight: (height: number) => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [visibility] = useState(() => new Animated.Value(1));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const toValue = hidden ? 0 : 1;
    if (reduceMotion) { visibility.setValue(toValue); return; }
    const animation = Animated.timing(visibility, {
      toValue, delay: hidden ? 120 : 0, duration: hidden ? 400 : 180, useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [hidden, reduceMotion, visibility]);

  return <Animated.View pointerEvents={hidden ? 'none' : 'box-none'}
    accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
    style={{
      position: 'absolute', top: insets.top + 12, left: insets.left, right: insets.right,
      opacity: visibility,
      transform: [{ translateY: visibility.interpolate({ inputRange: [0, 1], outputRange: [-height, 0] }) }],
    }}>
    <View style={styles.glass} onLayout={event => onHeight(event.nativeEvent.layout.height)}>
      <BlurView pointerEvents="none" blurTarget={blurTarget} blurMethod="dimezisBlurView" intensity={70} tint="light"
        style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.frost} />
      {children}
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  glass: { overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.75)' },
  frost: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.17)' },
});
