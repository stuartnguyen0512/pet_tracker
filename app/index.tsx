import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { ageStr } from '../lib/dates';
import { initialOf, speciesTint } from '../lib/petDisplay';
import { usePets } from '../store/pets';
import { Pet } from '../types';

export default function PetListScreen() {
  const router = useRouter();
  const { pets, unlocked } = usePets();

  const onAddPet = () => {
    if (pets.length >= 1 && !unlocked) {
      router.push('/paywall');
    } else {
      router.push('/pet/new');
    }
  };

  const renderPet = ({ item }: { item: Pet }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/pet/${item.id}`)}
    >
      <View style={[styles.avatar, { backgroundColor: speciesTint(item.species) }]}>
        <Text style={styles.avatarText}>{initialOf(item.name)}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.petName}>{item.name}</Text>
        <Text style={styles.petMeta}>
          {item.species}{ageStr(item.birthdate) ? ` · ${ageStr(item.birthdate)}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Pets</Text>
        <Pressable style={styles.iconButton} onPress={() => router.push('/settings')}>
          <Text style={styles.iconButtonText}>⚙︎</Text>
        </Pressable>
      </View>

      {pets.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🐾</Text>
          </View>
          <Text style={styles.emptyTitle}>No pets yet</Text>
          <Text style={styles.emptyBody}>Add your first pet to start keeping their health records.</Text>
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={p => p.id}
          renderItem={renderPet}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={onAddPet}>
          <Text style={styles.addButtonText}>+ Add Pet</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.text,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  iconButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  rowPressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.accent,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  petName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  petMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#C4C9CE',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentWeak,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
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
