import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenOnboarding, markOnboardingSeen } from './onboarding';

describe('onboarding flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults to not seen', async () => {
    expect(await hasSeenOnboarding()).toBe(false);
  });

  it('reports seen after markOnboardingSeen is called', async () => {
    await markOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(true);
  });

  it('stays seen across repeated checks (idempotent)', async () => {
    await markOnboardingSeen();
    await markOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(true);
  });
});
