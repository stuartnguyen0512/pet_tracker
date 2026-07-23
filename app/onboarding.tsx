import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { colors } from '../constants/theme';
import { markOnboardingSeen } from '../lib/onboarding';

const STEPS = [
  {
    icon: '🐾',
    title: 'Add your pets',
    body: 'Start with name, species, and a photo. Free for 14 days, then $4.99/month.',
  },
  {
    icon: '📋',
    title: 'Log health records',
    body: 'Vaccines, vet visits, medications, weight, and notes — each one takes seconds.',
  },
  {
    icon: '📶',
    title: 'Works fully offline',
    body: "Everything you log is saved instantly on this device, signal or not.",
  },
  {
    icon: '☁️',
    title: 'Sync when you want',
    body: 'Tap "Sync Now" in Settings to back up and share records across your own devices.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  const onGetStarted = async () => {
    await markOnboardingSeen();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.headline}>Welcome to PetTracker</Text>
        <Text style={styles.subhead}>A quick look at how it works.</Text>

        <View style={styles.steps}>
          {STEPS.map(step => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIconCircle}>
                <Text style={styles.stepIcon}>{step.icon}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.spacer} />

        <Pressable style={styles.primaryButton} onPress={onGetStarted}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subhead: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  steps: {
    marginTop: 36,
    gap: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentWeak,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIcon: {
    fontSize: 20,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  stepBody: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  primaryButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
});
