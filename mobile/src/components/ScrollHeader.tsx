import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ScrollHeader({ hidden, height, onHeight, children }: {
  hidden: boolean;
  height: number;
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
    <View style={styles.surface} onLayout={event => onHeight(event.nativeEvent.layout.height)}>
      {children}
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: '#FFFFFF', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: '#E9EEE9' },
});
