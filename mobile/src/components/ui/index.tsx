import type { ReactNode } from 'react';
import { StyleSheet, View, Text, type StyleProp, type ViewStyle, type TextInputProps } from 'react-native';
import { Button as PaperButton, Card as PaperCard, IconButton, TextInput as PaperInput } from 'react-native-paper';
import { colors, radii } from '../../theme';

export function Button({ title, onPress, secondary = false, disabled = false }: {
  title: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <PaperButton mode={secondary ? 'contained-tonal' : 'contained'} onPress={onPress}
    disabled={disabled} buttonColor={secondary ? colors.primaryContainer : colors.primary}
    textColor={secondary ? colors.primary : '#FFFFFF'} style={styles.button}
    contentStyle={styles.buttonContent} labelStyle={styles.buttonLabel}>{title}</PaperButton>;
}

export function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false,
  editable = true, maxLength }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
  keyboardType?: TextInputProps['keyboardType']; multiline?: boolean; editable?: boolean; maxLength?: number;
}) {
  return <PaperInput mode="outlined" label={label} value={value} onChangeText={onChangeText}
    placeholder={placeholder} keyboardType={keyboardType} editable={editable} maxLength={maxLength}
    autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} multiline={multiline}
    textAlignVertical={multiline ? 'top' : 'center'} outlineColor={colors.inputBorder}
    activeOutlineColor={colors.primary} textColor={colors.text}
    style={[styles.input, multiline && styles.multiline]} outlineStyle={styles.inputOutline} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <PaperCard mode="contained" style={styles.cardShell} contentStyle={[styles.card, style]}>{children}</PaperCard>;
}

export function PageHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return <View style={styles.header}>
    {onBack && <IconButton icon="chevron-left" accessibilityLabel="Go back" onPress={onBack} iconColor={colors.primary} size={28} style={styles.back} />}
    <View style={styles.headerText}><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>
  </View>;
}

const styles = StyleSheet.create({
  button: { borderRadius: radii.control, marginTop: 3 }, buttonContent: { minHeight: 50 },
  buttonLabel: { fontSize: 14, fontWeight: '800' },
  input: { backgroundColor: colors.input, fontSize: 14, marginTop: 4 },
  inputOutline: { borderRadius: 12 }, multiline: { minHeight: 92 },
  cardShell: { backgroundColor: 'transparent', borderRadius: radii.card },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 9 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  back: { margin: 0, marginLeft: -8 }, headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 21, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
