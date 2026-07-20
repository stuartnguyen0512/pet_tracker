import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/theme';
import { RECORD_TYPES, recordTypeMeta } from '../constants/recordTypes';
import { fromIsoDate, toIsoDate } from '../lib/dates';
import { deletePhotoIfExists, persistPhoto } from '../lib/photos';
import { useActionSheet } from '../store/actionSheet';
import { usePets } from '../store/pets';
import { useToast } from '../store/toast';
import { HealthRecord, RecordType } from '../types';

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

function splitWeightDetails(details: string): { value: string; unit: 'kg' | 'lb' } {
  const [value = '', unitToken] = details.trim().split(/\s+/);
  return { value, unit: unitToken === 'lb' ? 'lb' : 'kg' };
}

export function RecordFormScreen({ petId, record }: { petId: string; record?: HealthRecord }) {
  const router = useRouter();
  const { createRecord, updateRecord, deleteRecord } = usePets();
  const { showToast } = useToast();
  const { showActionSheet } = useActionSheet();

  const initialWeight = record?.type === 'Weight' ? splitWeightDetails(record.details) : { value: '', unit: 'kg' as const };

  const [type, setType] = useState<RecordType>(record?.type ?? 'Vaccine');
  const [date, setDate] = useState<Date>(record ? fromIsoDate(record.date) : new Date());
  const [details, setDetails] = useState(record && record.type !== 'Weight' ? record.details : '');
  const [weightValue, setWeightValue] = useState(initialWeight.value);
  const [unit, setUnit] = useState<'kg' | 'lb'>(initialWeight.unit);
  const [photo, setPhoto] = useState<string | null>(record?.photo ?? null);

  const isEditing = !!record;
  const isWeight = type === 'Weight';
  const canSave = !isWeight || weightValue.trim().length > 0;

  const onChangePhoto = () => {
    showActionSheet({
      options: [
        {
          label: 'Take Photo',
          onPress: async () => {
            const uri = await pickImage('camera');
            if (uri) setPhoto(uri);
          },
        },
        {
          label: 'Choose from Library',
          onPress: async () => {
            const uri = await pickImage('library');
            if (uri) setPhoto(uri);
          },
        },
        ...(photo
          ? [{ label: 'Remove Photo', style: 'destructive' as const, onPress: () => setPhoto(null) }]
          : []),
        { label: 'Cancel', style: 'cancel' as const, onPress: () => {} },
      ],
    });
  };

  const onSave = async () => {
    if (!canSave) return;
    const finalDetails = isWeight ? `${weightValue.trim()} ${unit}` : details.trim();
    // Photo is only moved into permanent storage (and the old one cleaned up)
    // once the user actually commits — picking a new photo and then hitting
    // Cancel must leave the original file and DB row untouched.
    const originalPhoto = record?.photo ?? null;
    let finalPhoto = photo;
    if (photo !== originalPhoto) {
      if (photo) finalPhoto = persistPhoto(photo, 'records');
      if (originalPhoto) deletePhotoIfExists(originalPhoto);
    }
    const data = { petId, type, date: toIsoDate(date), details: finalDetails, photo: finalPhoto };
    try {
      if (record) {
        await updateRecord(record.id, data);
      } else {
        await createRecord(data);
      }
      router.back();
      showToast('Record saved');
    } catch (e) {
      console.error('[RecordFormScreen] save failed:', e);
      showToast('Could not save — please try again');
    }
  };

  const onDelete = () => {
    if (!record) return;
    showActionSheet({
      message: "Delete this record? This can't be undone.",
      options: [
        {
          label: 'Delete Record',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecord(record.id);
              if (record.photo) deletePhotoIfExists(record.photo);
              router.back();
              showToast('Record deleted');
            } catch (e) {
              console.error('[RecordFormScreen] delete failed:', e);
              showToast('Could not delete — please try again');
            }
          },
        },
        { label: 'Cancel', style: 'cancel', onPress: () => {} },
      ],
    });
  };

  const meta = recordTypeMeta(type);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{isEditing ? 'Edit Record' : 'New Record'}</Text>
        <Pressable onPress={onSave} disabled={!canSave}>
          <Text style={[styles.save, { color: canSave ? colors.accent : colors.disabled }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.typeRow}>
          {RECORD_TYPES.map(t => {
            const active = type === t.type;
            return (
              <Pressable
                key={t.type}
                style={[styles.typeButton, active ? styles.typeButtonActive : styles.typeButtonInactive]}
                onPress={() => setType(t.type)}
              >
                <View style={[styles.typeIcon, { backgroundColor: t.tint }]}>
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                </View>
                <Text style={[styles.typeLabel, { color: active ? colors.accent : colors.textSecondary }]}>
                  {t.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={[styles.field, styles.fieldRow]}>
            <Text style={styles.fieldLabel}>DATE</Text>
            <DateTimePicker
              value={date}
              mode="date"
              display="compact"
              maximumDate={new Date()}
              onChange={(_, selected) => selected && setDate(selected)}
              style={styles.datePicker}
            />
          </View>
          <View style={styles.divider} />

          {isWeight ? (
            <View style={[styles.field, styles.fieldRow]}>
              <Text style={[styles.fieldLabel, { flex: 1 }]}>WEIGHT</Text>
              <TextInput
                value={weightValue}
                onChangeText={setWeightValue}
                inputMode="decimal"
                placeholder="0.0"
                style={styles.weightInput}
                placeholderTextColor={colors.textFaint}
              />
              <View style={styles.unitRow}>
                <Pressable
                  style={[styles.unitButton, { backgroundColor: unit === 'kg' ? colors.accent : colors.chipInactiveBg }]}
                  onPress={() => setUnit('kg')}
                >
                  <Text style={[styles.unitText, { color: unit === 'kg' ? colors.card : colors.textSecondary }]}>kg</Text>
                </Pressable>
                <Pressable
                  style={[styles.unitButton, { backgroundColor: unit === 'lb' ? colors.accent : colors.chipInactiveBg }]}
                  onPress={() => setUnit('lb')}
                >
                  <Text style={[styles.unitText, { color: unit === 'lb' ? colors.card : colors.textSecondary }]}>lb</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DETAILS</Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={meta.placeholder}
                multiline
                numberOfLines={3}
                style={styles.detailsInput}
                placeholderTextColor={colors.textFaint}
              />
            </View>
          )}
        </View>

        <Pressable style={styles.photoButton} onPress={onChangePhoto}>
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={styles.photoLabel}>{photo ? 'Photo added' : 'Add Photo'}</Text>
          {photo && <Image source={{ uri: photo }} style={styles.photoThumb} />}
        </Pressable>

        {isEditing && (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteButtonText}>Delete Record</Text>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  typeButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentWeak,
  },
  typeButtonInactive: {
    borderColor: '#EDEFF1',
    backgroundColor: colors.card,
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeEmoji: {
    fontSize: 15,
  },
  typeLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'center',
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
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  datePicker: {
    marginLeft: 'auto',
  },
  weightInput: {
    fontSize: 17,
    color: colors.text,
    width: 70,
    textAlign: 'right',
    padding: 0,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 4,
  },
  unitButton: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsInput: {
    fontSize: 17,
    color: colors.text,
    marginTop: 6,
    minHeight: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginLeft: 14,
  },
  photoButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  photoIcon: {
    fontSize: 20,
  },
  photoLabel: {
    fontSize: 16,
    color: colors.accent,
    flex: 1,
  },
  photoThumb: {
    width: 34,
    height: 34,
    borderRadius: 8,
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
