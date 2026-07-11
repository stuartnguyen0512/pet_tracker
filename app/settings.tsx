import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { exportJson } from '../lib/export';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';
import { useUiSession } from '../store/uiSession';

export default function SettingsScreen() {
  const router = useRouter();
  const { pets, listRecordsForPet, unlocked } = usePets();
  const { showToast } = useToast();
  const { isLoggedIn, isInitializing, logOut } = useUiSession();

  const onExportAll = async () => {
    showToast('Preparing…');
    const records = (await Promise.all(pets.map(p => listRecordsForPet(p.id)))).flat();
    const ok = await exportJson('pet-records', { pets, records });
    showToast(ok ? 'Export saved' : 'Sharing unavailable');
  };

  const onAccountRowPress = async () => {
    if (isLoggedIn) {
      try {
        await logOut();
        showToast('Logged out');
      } catch (e) {
        console.error('[Settings] sign out failed:', e);
        showToast('Could not log out — please try again');
      }
    } else {
      router.push('/login');
    }
  };

  const onSyncNow = () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    // UI only — no Supabase push/pull wired up yet.
    showToast('Nothing to sync yet');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.spacer} />
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.privacyCard}>
          <View style={styles.privacyHeader}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyTitle}>Your data stays on your device</Text>
          </View>
          <Text style={styles.privacyBody}>
            Everything you log is stored on this iPhone first and works fully offline. Signing in
            and syncing is optional — back up anytime by exporting a file, too.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <Pressable
          style={[styles.accountRow, isInitializing && styles.accountRowDisabled]}
          onPress={onAccountRowPress}
          disabled={isInitializing}
        >
          <Text style={styles.accountRowText}>
            {isInitializing ? 'Loading…' : isLoggedIn ? 'Log Out' : 'Log In or Sign Up'}
          </Text>
          {!isInitializing && !isLoggedIn && <Text style={styles.chevron}>›</Text>}
        </Pressable>
        <Text style={styles.exportHint}>Sync your pets and records across your own devices.</Text>

        <Text style={styles.sectionLabel}>Data</Text>
        <Pressable style={styles.exportButton} onPress={onExportAll}>
          <Text style={styles.exportButtonText}>Export all data</Text>
        </Pressable>
        <Text style={styles.exportHint}>Saves a file you can share or back up.</Text>

        <Pressable style={styles.syncButton} onPress={onSyncNow}>
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </Pressable>
        <Text style={styles.exportHint}>{isLoggedIn ? 'Never synced.' : 'Log in to enable sync.'}</Text>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutCard}>
          {!unlocked && (
            <Pressable style={styles.aboutRow} onPress={() => router.push('/paywall')}>
              <Text style={styles.unlockRowText}>Unlock more pets</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          <View style={styles.aboutRow}>
            <Text style={styles.aboutRowLabel}>Version</Text>
            <Text style={styles.aboutRowValue}>1.0 (MVP)</Text>
          </View>
          <View style={[styles.aboutRow, styles.aboutRowLast]}>
            <Text style={styles.aboutRowLabel}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F3F5',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  spacer: {
    width: 44,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  done: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.accent,
  },
  body: {
    padding: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  privacyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  privacyIcon: {
    fontSize: 18,
  },
  privacyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  privacyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
  },
  accountRowDisabled: {
    opacity: 0.5,
  },
  accountRowText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.accent,
  },
  exportButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
  syncButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '600',
  },
  exportHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
    paddingBottom: 24,
  },
  aboutCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  aboutRowLast: {
    borderBottomWidth: 0,
  },
  unlockRowText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.accent,
  },
  aboutRowLabel: {
    fontSize: 17,
    color: colors.text,
  },
  aboutRowValue: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 18,
    color: '#C4C9CE',
  },
});
