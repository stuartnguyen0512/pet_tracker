import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
import {
  isDuplicateEmailError,
  isStrongPassword,
  isValidEmail,
  PASSWORD_REQUIREMENT_TEXT,
} from '../lib/authValidation';
import { runSync } from '../lib/sync';
import { supabase } from '../lib/supabaseClient';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';

type Phase = 'idle' | 'authenticating' | 'syncing';

export default function SignupScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { db, refreshPets } = usePets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  // Signup is a `presentation: 'modal'` screen — same invisible-toast issue
  // as Settings' Sync Now and Login. Errors that leave the user still
  // looking at this screen need in-component state instead of a toast.
  const [errorText, setErrorText] = useState<string | null>(null);
  const isSubmitting = phase !== 'idle';

  const emailLooksValid = email.trim().length === 0 || isValidEmail(email);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordStrongEnough = password.length === 0 || isStrongPassword(password);
  const canSubmit =
    isValidEmail(email) &&
    isStrongPassword(password) &&
    passwordsMatch &&
    !isSubmitting;

  const onChangeEmail = (text: string) => {
    setEmail(text);
    setErrorText(null);
  };
  const onChangePassword = (text: string) => {
    setPassword(text);
    setErrorText(null);
  };
  const onChangeConfirmPassword = (text: string) => {
    setConfirmPassword(text);
    setErrorText(null);
  };

  const onCreateAccount = async () => {
    if (!canSubmit) return;
    setErrorText(null);
    setPhase('authenticating');
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        setErrorText(
          isDuplicateEmailError(error.message)
            ? 'This email is already registered — log in instead.'
            : error.message,
        );
        return;
      }
      // Supabase's anti-enumeration behavior for an already-registered email:
      // no `error`, but a synthetic user with an empty `identities` array and
      // no session. This is the only reliable signal in that case — it never
      // fires for a genuinely new signup, where `identities` is populated.
      if (data.user && data.user.identities?.length === 0) {
        setErrorText('This email is already registered — log in instead.');
        return;
      }
      if (data.session && data.user) {
        // Account is usable immediately (confirmations off) — force a sync
        // right away: any pets logged anonymously before signing up are
        // still sitting locally with dirty=1 and need pushing up as this
        // brand-new account's first sync.
        setPhase('syncing');
        try {
          await runSync(db, data.user.id);
          await refreshPets();
        } catch (e) {
          console.error('[Signup] initial sync failed:', e);
          showToast('Account created — sync failed, you can retry from Settings');
        }
        router.dismissTo('/');
      } else {
        // Confirmations required — don't pretend the user is signed in yet.
        showToast('Check your email to confirm your account');
        router.replace('/login');
      }
    } catch (e) {
      console.error('[Signup] sign up failed:', e);
      setErrorText('Could not create account — please try again');
    } finally {
      setPhase('idle');
    }
  };

  const onContinueWithApple = () => {
    // Alert.alert, not showToast — see the invisible-toast note above
    // (this screen is `presentation: 'modal'`, same issue as Login).
    Alert.alert('Apple Sign In coming soon');
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
        <Text style={styles.headline}>Create your account</Text>
        <Text style={styles.subhead}>Keep your pets' records backed up and available on every device.</Text>

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
              textContentType="newPassword"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={onChangeConfirmPassword}
              placeholder="••••••••"
              style={styles.input}
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              textContentType="newPassword"
            />
          </View>
        </View>
        {errorText && <Text style={styles.errorText}>{errorText}</Text>}
        {!emailLooksValid && <Text style={styles.errorText}>Enter a valid email address</Text>}
        {password.length > 0 && (
          <Text style={passwordStrongEnough ? styles.hintText : styles.errorText}>
            {PASSWORD_REQUIREMENT_TEXT}
          </Text>
        )}
        {confirmPassword.length > 0 && !passwordsMatch && (
          <Text style={styles.errorText}>Passwords don't match</Text>
        )}

        <Pressable
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          onPress={onCreateAccount}
          disabled={!canSubmit}
        >
          <Text style={styles.primaryButtonText}>
            {phase === 'authenticating' ? 'Creating Account…' : phase === 'syncing' ? 'Syncing…' : 'Create Account'}
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
          <Text style={styles.footerText}>Already have an account?</Text>
          <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
            <Text style={styles.footerLink}>Log In</Text>
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
  hintText: {
    fontSize: 13,
    color: colors.textSecondary,
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
