import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import * as Q from '../db/queries';
import { timeAgo } from '../lib/dates';
import { exportJson } from '../lib/export';
import { initialOf } from '../lib/petDisplay';
import { LAST_SYNCED_AT_KEY, runSync } from '../lib/sync';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';
import { useUiSession } from '../store/uiSession';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export default function SettingsScreen() {
  const router = useRouter();
  const { pets, listRecordsForPet, db, refreshPets, wipeAllLocal } = usePets();
  const { showToast } = useToast();
  const { isLoggedIn, isInitializing, logOut, user } = useUiSession();

  // Settings is presented as a modal (see app/_layout.tsx) — on iOS a native
  // modal renders in its own layer above everything, including the global
  // Toast overlay mounted at the app root, so toasts fired from in here are
  // invisible. Sync status has to live in the button itself instead, since
  // the button is guaranteed to be on top of whatever it's rendered inside.
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Q.getSetting(db, LAST_SYNCED_AT_KEY).then(setLastSyncedAt);
  }, [db]);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const onExportAll = async () => {
    showToast('Preparing…');
    const records = (await Promise.all(pets.map(p => listRecordsForPet(p.id)))).flat();
    const ok = await exportJson('pet-records', { pets, records });
    showToast(ok ? 'Export saved' : 'Sharing unavailable');
  };

  // Accounts are personal-only (no sharing) — a device's local SQLite must
  // never straddle two accounts, or the next sync's upsert collides with the
  // previous owner's Supabase RLS policy (owner_id = auth.uid()) and gets
  // rejected outright. So logout always wipes local data; it only pauses to
  // confirm first when that would actually lose unsynced work.
  const performLogout = async () => {
    try {
      await logOut();
      await wipeAllLocal();
      // dismissTo before showToast, not after — Settings is a modal, and a
      // toast fired while still inside it is invisible (same root cause as
      // MIN-43's login/signup toasts). Leaving the modal first means the
      // toast renders over the now-visible home screen instead.
      router.dismissTo('/');
      showToast('Logged out');
    } catch (e) {
      console.error('[Settings] sign out failed:', e);
      showToast('Could not log out — please try again');
    }
  };

  const onAccountRowPress = async () => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    // Always confirm before logout, not only when there's unsynced work —
    // logout is a destructive, irreversible local action either way (it
    // wipes this device's local data even when everything's already synced,
    // per the Reversibility Rule and PRD §7.7), and a bare "you got logged
    // out" with no warning at all is surprising regardless of dirty state.
    //
    // Alert.alert (not the custom ActionSheet) on purpose: it's a native
    // UIAlertController call, not a React-rendered overlay, so it can't run
    // into the modal-inside-modal rendering problem that a component like
    // ActionSheet risks when opened from a screen that's itself presented
    // as a router-level `presentation: 'modal'` (Settings is one).
    //
    // try/catch here matters, not just style: MIN-55 was specifically about
    // this row silently doing nothing with no explanation. hasDirtyData is
    // the one part of this flow that can throw before the Alert ever shows —
    // without a catch, that failure is invisible to the user again.
    try {
      const dirty = await Q.hasDirtyData(db);
      Alert.alert(
        'Log Out',
        dirty
          ? "You have changes that haven't been synced yet. Logging out deletes all local data on this device — sync first if you want to keep it."
          : "You'll need to sign in again to sync your pets and records on this device.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: performLogout },
        ],
      );
    } catch (e) {
      console.error('[Settings] could not check sync state for logout:', e);
      showToast('Something went wrong — please try again');
    }
  };

  const onSyncNow = async () => {
    if (!isLoggedIn || !user) {
      router.push('/login');
      return;
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setSyncState('syncing');
    try {
      await runSync(db, user.id);
      await refreshPets();
      setLastSyncedAt(await Q.getSetting(db, LAST_SYNCED_AT_KEY));
      setSyncState('success');
    } catch (e) {
      console.error('[Settings] sync failed:', e);
      setSyncState('error');
    }
    resetTimer.current = setTimeout(() => setSyncState('idle'), 1800);
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
          {isLoggedIn && (
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>{initialOf(user?.email ?? '?')}</Text>
            </View>
          )}
          <View style={styles.accountRowBody}>
            <Text
              style={[styles.accountRowText, isLoggedIn && styles.accountRowTextLoggedIn]}
              numberOfLines={1}
            >
              {isInitializing ? 'Loading…' : isLoggedIn ? (user?.email ?? 'Signed in') : 'Log In or Sign Up'}
            </Text>
            {isLoggedIn && !isInitializing && <Text style={styles.accountRowSubtext}>Log Out</Text>}
          </View>
          {!isInitializing && !isLoggedIn && <Text style={styles.chevron}>›</Text>}
        </Pressable>
        <Text style={styles.exportHint}>Sync your pets and records across your own devices.</Text>

        <Text style={styles.sectionLabel}>Data</Text>
        <Pressable style={styles.exportButton} onPress={onExportAll}>
          <Text style={styles.exportButtonText}>Export all data</Text>
        </Pressable>
        <Text style={styles.exportHint}>Saves a file you can share or back up.</Text>

        <Pressable
          style={({ pressed }) => [
            styles.syncButton,
            pressed && styles.syncButtonPressed,
            syncState === 'syncing' && styles.syncButtonDisabled,
          ]}
          onPress={onSyncNow}
          disabled={syncState === 'syncing'}
        >
          {syncState === 'syncing' ? (
            <View style={styles.syncButtonRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.syncButtonText}>Syncing…</Text>
            </View>
          ) : syncState === 'success' ? (
            <Text style={styles.syncButtonText}>✓ Synced</Text>
          ) : syncState === 'error' ? (
            <Text style={[styles.syncButtonText, styles.syncButtonTextError]}>
              Sync failed — tap to retry
            </Text>
          ) : (
            <Text style={styles.syncButtonText}>Sync Now</Text>
          )}
        </Pressable>
        <Text style={styles.exportHint}>
          {!isLoggedIn
            ? 'Log in to enable sync.'
            : lastSyncedAt
              ? `Last synced ${timeAgo(lastSyncedAt)}`
              : 'Never synced.'}
        </Text>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutCard}>
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
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
  },
  accountRowDisabled: {
    opacity: 0.5,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  accountRowBody: {
    flex: 1,
    minWidth: 0,
  },
  accountRowText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.accent,
  },
  accountRowTextLoggedIn: {
    color: colors.text,
  },
  accountRowSubtext: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 2,
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
  syncButtonPressed: {
    backgroundColor: colors.accentWeak,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButtonText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '600',
  },
  syncButtonTextError: {
    color: colors.danger,
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
