import { colors } from '../theme';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, type PanResponderCallbacks } from 'react-native';

export function ProfileSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const [translateY] = useState(() => new Animated.Value(Dimensions.get('screen').height));
  const [shadeOpacity] = useState(() => new Animated.Value(0));
  const [present, setPresent] = useState(visible);
  const [previousVisible, setPreviousVisible] = useState(visible);
  // Keep the modal mounted during its exit animation, including Save/Cancel.
  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (visible) setPresent(true);
  }
  useEffect(() => {
    if (!present) return;
    const offscreen = Dimensions.get('screen').height;
    if (visible) return;
    const animation = Animated.parallel([
      Animated.timing(shadeOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: offscreen, duration: 140, useNativeDriver: true }),
    ], { stopTogether: false });
    animation.start(({ finished }) => { if (finished && !visible) setPresent(false); });
    return () => animation.stop();
  }, [visible, present, translateY, shadeOpacity]);
  const pan = useMemo(() => {
    const springBack = () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    const handlers: PanResponderCallbacks = {
      // Leave taps and text-field interactions alone until a downward drag starts.
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx),
      onPanResponderGrant: () => translateY.stopAnimation(),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 80 || (gesture.dy > 20 && gesture.vy > 0.8)) onClose();
        else springBack();
      },
      onPanResponderTerminate: springBack,
    };
    return {
      body: PanResponder.create(handlers),
      header: PanResponder.create({ ...handlers, onStartShouldSetPanResponder: () => true }),
    };
  }, [translateY, onClose]);
  return <Modal visible={present} transparent animationType="none" onRequestClose={onClose} onShow={() => {
    // Android must attach the modal's native views before driving their opacity.
    if (!visible) return;
    translateY.setValue(Dimensions.get('screen').height); shadeOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(shadeOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ], { stopTogether: false }).start();
  }}>
    <View style={styles.root} collapsable={false}>
    <Animated.View pointerEvents="none" style={[styles.dimming, { opacity: shadeOpacity }]} />
    <KeyboardAvoidingView style={styles.shade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable disabled={!visible} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Close profile" onPress={onClose} />
      <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.card, { transform: [{ translateY }] }]} {...pan.body.panHandlers} onAccessibilityEscape={onClose}>
        <View style={styles.header} {...pan.header.panHandlers}>
          <View style={styles.handle} />
          <Text style={styles.title}>Citizen profile</Text>
          <Text style={styles.subtitle}>Used to prepare and track your grievance.</Text>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.fields} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  dimming: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(14,31,21,0.38)' },
  backdrop: { flex: 1, minHeight: 48 },
  card: { maxHeight: '90%', flexShrink: 1, borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: '#FFF', padding: 22, paddingBottom: 32, gap: 10 },
  body: { flexGrow: 0, flexShrink: 1 },
  fields: { gap: 10 },
  header: { gap: 10 },
  title: { color: colors.text, fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#738078', fontSize: 12, lineHeight: 18 },
  handle: { height: 4, width: 42, backgroundColor: '#D8DFD8', borderRadius: 4, alignSelf: 'center', marginBottom: 4 },
});
