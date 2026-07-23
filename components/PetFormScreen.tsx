import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { fromIsoDate, toIsoDate } from '../lib/dates';
import { deletePhotoIfExists, persistPhoto } from '../lib/photos';
import { runSync } from '../lib/sync';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';
import { useUiSession } from '../store/uiSession';
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
  const { createPet, updatePet, deletePet, listRecordsForPet, db, refreshPets } = usePets();
  const { showToast } = useToast();
  const { isLoggedIn, user } = useUiSession();

  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<string>(pet?.species ?? 'Dog');
  const [birthdate, setBirthdate] = useState<Date | null>(pet?.birthdate ? fromIsoDate(pet.birthdate) : null);
  const [photo, setPhoto] = useState<string | null>(pet?.photo ?? null);

  const isEditing = !!pet;
  const canSave = name.trim().length > 0;

  const onChangePhoto = () => {
    // Alert.alert, not the custom ActionSheet — this screen is itself a
    // router-level `presentation: 'modal'` (pet/new, pet/[id]/edit), and RN's
    // Modal (which ActionSheet uses) fails to present nested inside a screen
    // that's already shown as a native modal. Alert.alert is a native
    // UIAlertController call, not a React-rendered overlay, so it doesn't hit
    // that modal-inside-modal problem — same reasoning as Settings' logout
    // confirmation.
    Alert.alert('Add Photo', undefined, [
      {
        text: 'Take Photo',
        onPress: async () => {
          const uri = await pickImage('camera');
          if (uri) setPhoto(uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const uri = await pickImage('library');
          if (uri) setPhoto(uri);
        },
      },
      ...(photo
        ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setPhoto(null) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const onSave = async () => {
    if (!canSave) return;
    // Photo is only moved into permanent storage (and the old one cleaned up)
    // once the user actually commits — picking a new photo and then hitting
    // Cancel must leave the original file and DB row untouched.
    const originalPhoto = pet?.photo ?? null;
    let finalPhoto = photo;
    if (photo !== originalPhoto) {
      if (photo) finalPhoto = persistPhoto(photo, 'pets');
      if (originalPhoto) deletePhotoIfExists(originalPhoto);
    }
    const data = { name: name.trim(), species, birthdate: birthdate ? toIsoDate(birthdate) : null, photo: finalPhoto };
    try {
      if (pet) {
        await updatePet(pet.id, data);
        router.back();
        return;
      }

      await createPet(data);

      // Only prompt on create, not edit — an "edit" already happened to a
      // pet that's presumably been synced before, so it's just one more
      // dirty row same as any other; asking every time would get old fast.
      // A brand new pet is the one moment worth interrupting for.
      if (isLoggedIn && user) {
        // Alert.alert, not the custom ActionSheet — see onChangePhoto above
        // for why (this screen is itself a `presentation: 'modal'`).
        Alert.alert('Sync this pet to your account now?', undefined, [
          {
            text: 'Sync Now',
            onPress: async () => {
              try {
                await runSync(db, user.id);
                await refreshPets();
              } catch (e) {
                console.error('[PetFormScreen] sync failed:', e);
                showToast('Sync failed — you can retry from Settings');
              }
              router.back();
            },
          },
          { text: 'Not Now', style: 'cancel', onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
    } catch (e) {
      console.error('[PetFormScreen] save failed:', e);
      showToast('Could not save — please try again');
    }
  };

  const onDelete = () => {
    if (!pet) return;
    // Alert.alert, not the custom ActionSheet — see onChangePhoto above for
    // why (this screen is itself a `presentation: 'modal'`).
    Alert.alert(
      `Delete ${pet.name}?`,
      "This also removes all their records. This can't be undone.",
      [
        {
          text: 'Delete Pet',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
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
          <View style={[styles.field, styles.fieldRow]}>
            <Text style={styles.fieldLabel}>
              BIRTHDATE <Text style={styles.fieldLabelOptional}>(optional)</Text>
            </Text>
            {birthdate ? (
              <View style={styles.birthdateRow}>
                <DateTimePicker
                  value={birthdate}
                  mode="date"
                  display="compact"
                  maximumDate={new Date()}
                  onChange={(_, selected) => selected && setBirthdate(selected)}
                />
                <Pressable onPress={() => setBirthdate(null)} hitSlop={8}>
                  <Text style={styles.clearDate}>Clear</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setBirthdate(new Date())}>
                <Text style={styles.setDateLink}>Set date</Text>
              </Pressable>
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
  input: {
    fontSize: 17,
    color: colors.text,
    padding: 0,
  },
  birthdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  setDateLink: {
    fontSize: 16,
    color: colors.accent,
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
