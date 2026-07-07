import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActionSheetIOS,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { isValidIsoDate } from '../lib/dates';
import { deletePhotoIfExists, persistPhoto } from '../lib/photos';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';
import { Pet } from '../types';

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Other'] as const;

async function pickImage(source: 'camera' | 'library'): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

export function PetFormScreen({ pet }: { pet?: Pet }) {
  const router = useRouter();
  const { createPet, updatePet, deletePet, listRecordsForPet, pets, unlocked } = usePets();
  const { showToast } = useToast();

  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<string>(pet?.species ?? 'Dog');
  const [birthdate, setBirthdate] = useState(pet?.birthdate ?? '');
  const [photo, setPhoto] = useState<string | null>(pet?.photo ?? null);

  const isEditing = !!pet;
  const birthdateTrimmed = birthdate.trim();
  const birthdateValid = birthdateTrimmed.length === 0 || isValidIsoDate(birthdateTrimmed);
  const canSave = name.trim().length > 0 && birthdateValid;

  const onChangePhoto = () => {
    const options = photo
      ? ['Take Photo', 'Choose from Library', 'Remove Photo', 'Cancel']
      : ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = photo ? 2 : undefined;

    ActionSheetIOS.showActionSheetWithOptions(
      { options, cancelButtonIndex, destructiveButtonIndex },
      async buttonIndex => {
        if (buttonIndex === 0 || buttonIndex === 1) {
          const uri = await pickImage(buttonIndex === 0 ? 'camera' : 'library');
          if (uri) setPhoto(uri);
        } else if (photo && buttonIndex === 2) {
          setPhoto(null);
        }
      },
    );
  };

  const onSave = async () => {
    if (!canSave) return;
    // Re-check the paywall gate here too, not just at the "+ Add Pet" button —
    // a double-tap can push this screen twice before the first save commits,
    // and app/index.tsx's check alone can't catch that.
    if (!pet && pets.length >= 1 && !unlocked) {
      router.replace('/paywall');
      return;
    }
    // Photo is only moved into permanent storage (and the old one cleaned up)
    // once the user actually commits — picking a new photo and then hitting
    // Cancel must leave the original file and DB row untouched.
    const originalPhoto = pet?.photo ?? null;
    let finalPhoto = photo;
    if (photo !== originalPhoto) {
      if (photo) finalPhoto = persistPhoto(photo, 'pets');
      if (originalPhoto) deletePhotoIfExists(originalPhoto);
    }
    const data = { name: name.trim(), species, birthdate: birthdateTrimmed || null, photo: finalPhoto };
    try {
      if (pet) {
        await updatePet(pet.id, data);
      } else {
        await createPet(data);
      }
      router.back();
    } catch (e) {
      console.error('[PetFormScreen] save failed:', e);
      showToast('Could not save — please try again');
    }
  };

  const onDelete = () => {
    if (!pet) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        message: `Delete ${pet.name}? This also removes all their records. This can't be undone.`,
        options: ['Delete Pet', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      async buttonIndex => {
        if (buttonIndex === 0) {
          try {
            const records = await listRecordsForPet(pet.id);
            records.forEach(r => deletePhotoIfExists(r.photo));
            deletePhotoIfExists(pet.photo);
            await deletePet(pet.id);
            showToast(`${pet.name} deleted`);
            router.dismissTo('/');
          } catch (e) {
            console.error('[PetFormScreen] delete failed:', e);
            showToast('Could not delete — please try again');
          }
        }
      },
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{isEditing ? 'Edit Pet' : 'New Pet'}</Text>
        <Pressable onPress={onSave} disabled={!canSave}>
          <Text style={[styles.save, { color: canSave ? colors.accent : colors.disabled }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.photoRow}>
          <Pressable style={styles.photoButton} onPress={onChangePhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photoImage} />
            ) : (
              <>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoLabel}>Add Photo</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Miló"
              style={styles.input}
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SPECIES</Text>
            <View style={styles.pillRow}>
              {SPECIES_OPTIONS.map(option => {
                const active = species === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                    onPress={() => setSpecies(option)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.field}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>
                BIRTHDATE <Text style={styles.fieldLabelOptional}>(optional)</Text>
              </Text>
              <TextInput
                value={birthdate}
                onChangeText={setBirthdate}
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
                placeholderTextColor={colors.textFaint}
              />
            </View>
            {birthdateTrimmed.length > 0 && !birthdateValid && (
              <Text style={styles.fieldError}>Enter a valid date as YYYY-MM-DD</Text>
            )}
          </View>
        </View>

        {isEditing && (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete Pet</Text>
          </Pressable>
        )}
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
  cancel: {
    fontSize: 17,
    color: colors.accent,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  save: {
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  photoRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentWeak,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: 96,
    height: 96,
  },
  photoIcon: {
    fontSize: 24,
  },
  photoLabel: {
    fontSize: 12,
    color: colors.accent,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  field: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  fieldLabelOptional: {
    textTransform: 'none',
  },
  fieldError: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
  },
  input: {
    fontSize: 17,
    color: colors.text,
    padding: 0,
  },
  dateInput: {
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 0.5,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.accentWeak,
    borderColor: colors.accent,
  },
  pillInactive: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.accent,
  },
  deleteButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.danger,
  },
});
