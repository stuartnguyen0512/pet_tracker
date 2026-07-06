import { Stack } from 'expo-router';
import { PetsProvider } from '../store/pets';

export default function RootLayout() {
  return (
    <PetsProvider>
      <Stack />
    </PetsProvider>
  );
}
