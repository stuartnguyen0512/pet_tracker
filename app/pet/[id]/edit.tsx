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
    // dismissTo (not back): PetFormScreen's own delete handler already calls
    // dismissTo('/') when the delete happens from this screen, which unmounts
    // us before this effect's pets[] update even lands. back() here would then
    // find no route left to pop and throw "GO_BACK not handled by any
    // navigator". dismissTo('/') is safe to call again in that case (it's a
    // no-op once already at the root) and still covers the other case this
    // effect exists for — the pet vanishing for a reason other than this
    // screen's own delete button, e.g. a pulled remote tombstone.
    if (!pet) router.dismissTo('/');
  }, [pet, router]);

  if (!pet) return null;

  return <PetFormScreen pet={pet} />;
}
