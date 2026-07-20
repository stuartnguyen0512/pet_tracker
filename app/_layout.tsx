import { Stack } from 'expo-router';
import { ActionSheetProvider } from '../store/actionSheet';
import { PetsProvider } from '../store/pets';
import { ToastProvider } from '../store/toast';
import { UiSessionProvider } from '../store/uiSession';

export default function RootLayout() {
  return (
    <PetsProvider>
      <ToastProvider>
        <ActionSheetProvider>
          <UiSessionProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="pet/[id]/index" />
              <Stack.Screen name="pet/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="pet/[id]/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="pet/[id]/record/new" options={{ presentation: 'modal' }} />
              <Stack.Screen name="pet/[id]/record/[recordId]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="login" options={{ presentation: 'modal' }} />
              <Stack.Screen name="signup" options={{ presentation: 'modal' }} />
              <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            </Stack>
          </UiSessionProvider>
        </ActionSheetProvider>
      </ToastProvider>
    </PetsProvider>
  );
}
