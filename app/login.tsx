import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { isValidEmail } from '../lib/authValidation';
import { runSync } from '../lib/sync';
import { supabase } from '../lib/supabaseClient';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';

type Phase = 'idle' | 'authenticating' | 'syncing';

export default function LoginScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { db, refreshPets } = usePets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  // Login is a `presentation: 'modal'` screen — on iOS a native modal renders
  // above everything including the root-mounted Toast overlay, so a toast
  // fired from in here (same bug as Settings' Sync Now) is invisible. Errors
  // that leave the user still looking at this screen need in-component state
  // instead; sync-failure toasts below are fine since they fire right before
  // dismissTo('/') takes the user off this screen entirely.
  const [errorText, setErrorText] = useState<string | null>(null);
  const isSubmitting = phase !== 'idle';

  const emailLooksValid = email.trim().length === 0 || isValidEmail(email);
  const canSubmit = isValidEmail(email) && password.length > 0 && !isSubmitting;

  const onChangeEmail = (text: string) => {
    setEmail(text);
    setErrorText(null);
  };
  const onChangePassword = (text: string) => {
    setPassword(text);
    setErrorText(null);
  };

  const onLogIn = async () => {
    if (!canSubmit) return;
    setErrorText(null);
    setPhase('authenticating');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setErrorText('Invalid email or password');
        return;
      }
      // Force a sync right after login, before the user ever sees the app in
      // this session — this is what restores pets synced from other devices,
      // and it's the only point a fresh account swap on this device gets
      // reconciled. If it fails, don't block entry: the app must still work
      // fully offline (hybrid gating), so let them in and they can retry
      // from Settings.
      setPhase('syncing');
      try {
        await runSync(db, data.user.id);
        await refreshPets();
      } catch (e) {
        console.error('[Login] initial sync failed:', e);
        showToast('Logged in — sync failed, you can retry from Settings');
      }
      router.dismissTo('/');
    } catch (e) {
      console.error('[Login] sign in failed:', e);
      setErrorText('Could not log in — please try again');
    } finally {
      setPhase('idle');
    }
  };

  const onContinueWithApple = () => {
    showToast('Apple Sign In coming soon');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Welcome back</Text>
        <Text style={styles.subhead}>Log in to sync your pets across devices.</Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={onChangeEmail}
              placeholder="you@example.com"
              style={styles.input}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={onChangePassword}
              placeholder="••••••••"
              style={styles.input}
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              textContentType="password"
            />
          </View>
        </View>
        {errorText && <Text style={styles.errorText}>{errorText}</Text>}
        {!emailLooksValid && <Text style={styles.errorText}>Enter a valid email address</Text>}

        <Pressable
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          onPress={onLogIn}
          disabled={!canSubmit}
        >
          <Text style={styles.primaryButtonText}>
            {phase === 'authenticating' ? 'Logging In…' : phase === 'syncing' ? 'Syncing…' : 'Log In'}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={[styles.appleButton, styles.appleButtonDisabled]} onPress={onContinueWithApple}>
          <Text style={styles.appleIcon}>􀣺</Text>
          <Text style={styles.appleButtonText}>Continue with Apple</Text>
        </Pressable>

        <View style={styles.spacer} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <Pressable onPress={() => router.replace('/signup')} hitSlop={8}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  subhead: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 28,
  },
  field: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    fontSize: 17,
    color: colors.text,
    padding: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  primaryButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.disabled,
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: 13,
    color: colors.textFaint,
  },
  appleButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 13,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  appleButtonDisabled: {
    opacity: 0.4,
  },
  appleIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: -2,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
});
