import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export type ActionSheetOption = {
  label: string;
  style?: 'default' | 'destructive' | 'cancel';
  onPress: () => void;
};

type ActionSheetProps = {
  visible: boolean;
  message?: string;
  options: ActionSheetOption[];
  onRequestClose: () => void;
};

// Presentational only — store/actionSheet.tsx owns when this is shown and
// wires each option's onPress to also dismiss it. Uses RN's own Modal (not
// an absolutely-positioned overlay like store/toast.tsx's) specifically
// because Modal presents in its own native layer above everything,
// including a screen that's itself a router-level `presentation: 'modal'`
// (Settings, the pet/record forms) — the same class of bug fixed in
// MIN-43/44 for toasts would otherwise hide this too.
export function ActionSheet({ visible, message, options, onRequestClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const cancelOption = options.find(o => o.style === 'cancel');
  const mainOptions = options.filter(o => o.style !== 'cancel');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.card}>
            {message && (
              <View style={styles.messageRow}>
                <Text style={styles.messageText}>{message}</Text>
              </View>
            )}
            {mainOptions.map((opt, i) => (
              <Pressable
                key={opt.label}
                style={({ pressed }) => [
                  styles.optionRow,
                  i !== mainOptions.length - 1 && styles.optionDivider,
                  pressed && styles.optionPressed,
                ]}
                onPress={opt.onPress}
              >
                <Text style={[styles.optionText, opt.style === 'destructive' && styles.optionTextDestructive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {cancelOption && (
            <Pressable
              style={({ pressed }) => [styles.card, styles.cancelRow, pressed && styles.optionPressed]}
              onPress={cancelOption.onPress}
            >
              <Text style={styles.cancelText}>{cancelOption.label}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,17,20,0.4)',
  },
  sheet: {
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  messageRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  messageText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  optionRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  optionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  optionPressed: {
    backgroundColor: colors.background,
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.accent,
  },
  optionTextDestructive: {
    color: colors.danger,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.accent,
  },
});
