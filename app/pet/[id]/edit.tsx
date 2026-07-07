import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { PetFormScreen } from '../../../components/PetFormScreen';
import { usePets } from '../../../store/pets';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { pets } = usePets();
  const pet = pets.find(p => p.id === id);

  useEffect(() => {
    if (!pet) router.back();
  }, [pet, router]);

  if (!pet) return null;

  return <PetFormScreen pet={pet} />;
}
