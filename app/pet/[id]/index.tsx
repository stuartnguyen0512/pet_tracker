import { useCallback, useEffect, useState } from 'react';
import { ActionSheetIOS, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../../constants/theme';
import { RECORD_TYPES, recordTypeMeta } from '../../../constants/recordTypes';
import { ageStr, monthLabel, shortDate } from '../../../lib/dates';
import { exportJson } from '../../../lib/export';
import { initialOf, speciesTint } from '../../../lib/petDisplay';
import { usePets } from '../../../store/pets';
import { useToast } from '../../../store/toast';
import { HealthRecord, RecordType } from '../../../types';

type FilterKey = 'All' | RecordType;

type TimelineGroup = {
  label: string;
  items: HealthRecord[];
};

export default function PetProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { pets, listRecordsForPet } = usePets();
  const { showToast } = useToast();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>('All');

  const pet = pets.find(p => p.id === id);

  const refetch = useCallback(() => {
    if (!id) return;
    listRecordsForPet(id).then(setRecords);
  }, [id, listRecordsForPet]);

  useFocusEffect(refetch);

  useEffect(() => {
    // Pet was deleted (e.g. from the edit screen) — nothing to show, go back.
    if (!pet) router.replace('/');
  }, [pet, router]);

  if (!pet) return null;

  const filtered = filter === 'All' ? records : records.filter(r => r.type === filter);
  const groups: TimelineGroup[] = [];
  const groupIndex: Record<string, number> = {};
  for (const r of filtered) {
    const label = monthLabel(r.date);
    if (groupIndex[label] === undefined) {
      groupIndex[label] = groups.length;
      groups.push({ label, items: [] });
    }
    groups[groupIndex[label]].items.push(r);
  }

  const onOpenMenu = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Edit Pet', `Export ${pet.name}'s records`, 'Cancel'],
        cancelButtonIndex: 2,
      },
      async buttonIndex => {
        if (buttonIndex === 0) {
          router.push(`/pet/${pet.id}/edit`);
        } else if (buttonIndex === 1) {
          showToast('Preparing…');
          const ok = await exportJson(`${pet.name.toLowerCase()}-records`, { pet, records });
          showToast(ok ? 'Export ready' : 'Sharing unavailable');
        }
      },
    );
  };

  const filters: FilterKey[] = ['All', ...RECORD_TYPES.map(t => t.type)];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>My Pets</Text>
        </Pressable>
        <Pressable style={styles.menuButton} onPress={onOpenMenu}>
          <Text style={styles.menuDots}>•••</Text>
        </Pressable>
      </View>

      <View style={styles.petHeader}>
        <View style={[styles.avatar, { backgroundColor: speciesTint(pet.species) }]}>
          <Text style={styles.avatarText}>{initialOf(pet.name)}</Text>
        </View>
        <View>
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petMeta}>
            {pet.species}{ageStr(pet.birthdate) ? ` · ${ageStr(pet.birthdate)}` : ''}
          </Text>
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={filters}
        keyExtractor={f => f}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const active = filter === item;
          return (
            <Pressable
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item === 'All' ? 'All' : recordTypeMeta(item).label}
              </Text>
            </Pressable>
          );
        }}
      />

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>📋</Text>
          </View>
          <Text style={styles.emptyTitle}>No records yet</Text>
          <Text style={styles.emptyBody}>
            Log a vaccine, vet visit, medication, weight, or note — it only takes a few seconds.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.label}
          contentContainerStyle={styles.timeline}
          renderItem={({ item: group }) => (
            <View>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.groupCard}>
                {group.items.map((r, i) => {
                  const meta = recordTypeMeta(r.type);
                  return (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.recordRow,
                        i !== group.items.length - 1 && styles.recordRowDivider,
                      ]}
                      onPress={() => router.push(`/pet/${pet.id}/record/${r.id}`)}
                    >
                      <View style={[styles.recordIcon, { backgroundColor: meta.tint }]}>
                        <Text style={styles.recordEmoji}>{meta.emoji}</Text>
                      </View>
                      <View style={styles.recordBody}>
                        <Text style={[styles.recordType, { color: meta.ic }]}>
                          {meta.label.toUpperCase()}
                        </Text>
                        <Text style={styles.recordDetail} numberOfLines={1}>
                          {r.details || meta.label}
                        </Text>
                      </View>
                      {r.photo && <View style={styles.photoThumb} />}
                      <Text style={styles.recordDate}>{shortDate(r.date)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push(`/pet/${pet.id}/record/new`)}
        >
          <Text style={styles.addButtonText}>+ Add Record</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backArrow: {
    fontSize: 24,
    color: colors.accent,
    marginRight: 2,
  },
  backLabel: {
    fontSize: 17,
    color: colors.accent,
  },
  menuButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDots: {
    fontSize: 14,
    color: colors.accent,
    letterSpacing: 1,
  },
  petHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 27,
    fontWeight: '600',
    color: colors.accent,
  },
  petName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 32,
  },
  petMeta: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 3,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 0.5,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipInactive: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.card,
  },
  timeline: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 8,
    paddingTop: 14,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  recordRowDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEF0F2',
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordEmoji: {
    fontSize: 16,
  },
  recordBody: {
    flex: 1,
    minWidth: 0,
  },
  recordType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recordDetail: {
    fontSize: 16,
    color: colors.text,
    marginTop: 2,
  },
  photoThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF0F2',
  },
  recordDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentWeak,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  addButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.card,
    fontSize: 17,
    fontWeight: '600',
  },
});
