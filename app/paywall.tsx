import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { initialOf, speciesTint } from '../lib/petDisplay';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';

const PRICE = '$7.99';

const POINTS = [
  'Add unlimited pets',
  'One-time payment — never a subscription',
  'Works fully offline, forever',
];

export default function PaywallScreen() {
  const router = useRouter();
  const { pets, unlockPets } = usePets();
  const { showToast } = useToast();
  const firstPet = pets[0];

  const onUnlock = async () => {
    // NOTE: this only flips a locally-persisted flag — there is no StoreKit /
    // in-app-purchase integration wired up yet. Real payment collection is a
    // separate follow-up (needs an IAP library + App Store Connect product).
    await unlockPets();
    showToast('Unlocked — add your pet');
    router.replace('/pet/new');
  };

  const onRestore = () => {
    showToast('No purchases to restore');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.avatarStack}>
          <View style={[styles.avatar, { backgroundColor: firstPet ? speciesTint(firstPet.species) : colors.accentWeak }]}>
            <Text style={styles.avatarText}>{firstPet ? initialOf(firstPet.name) : '🐾'}</Text>
          </View>
          <View style={[styles.avatar, styles.avatarSecond]}>
            <Text style={styles.avatarText}>+</Text>
          </View>
        </View>

        <Text style={styles.headline}>Add another pet</Text>
        <Text style={styles.subhead}>One-time unlock for a whole household.</Text>

        <View style={styles.points}>
          {POINTS.map(text => (
            <View key={text} style={styles.pointRow}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.pointText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        <Pressable style={styles.unlockButton} onPress={onUnlock}>
          <Text style={styles.unlockButtonText}>Unlock for {PRICE}</Text>
        </Pressable>
        <Pressable style={styles.restoreButton} onPress={onRestore}>
          <Text style={styles.restoreButtonText}>Restore purchase</Text>
        </Pressable>
        <Text style={styles.fineprint}>
          Your first pet is always free. This is a single one-time purchase — never a subscription.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    padding: 14,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAEBED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    marginBottom: 22,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarSecond: {
    backgroundColor: '#F0EDEA',
    marginLeft: -16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.accent,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  subhead: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  points: {
    alignSelf: 'stretch',
    marginTop: 28,
    gap: 16,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkmark: {
    fontSize: 18,
    color: colors.accent,
    fontWeight: '700',
  },
  pointText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  unlockButton: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  unlockButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 14,
  },
  restoreButtonText: {
    fontSize: 15,
    color: colors.accent,
  },
  fineprint: {
    fontSize: 12,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 17,
  },
});
