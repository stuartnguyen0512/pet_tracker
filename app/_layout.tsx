import { Stack } from 'expo-router';
import { PetsProvider } from '../store/pets';
import { ToastProvider } from '../store/toast';

export default function RootLayout() {
  return (
    <PetsProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="pet/[id]/index" />
          <Stack.Screen name="pet/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pet/[id]/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pet/[id]/record/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pet/[id]/record/[recordId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        </Stack>
      </ToastProvider>
    </PetsProvider>
  );
}
