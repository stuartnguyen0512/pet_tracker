import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RecordFormScreen } from '../../../../components/RecordFormScreen';
import { colors } from '../../../../constants/theme';
import { usePets } from '../../../../store/pets';
import { HealthRecord } from '../../../../types';

export default function EditRecordScreen() {
  const { id, recordId } = useLocalSearchParams<{ id: string; recordId: string }>();
  const router = useRouter();
  const { getRecord } = usePets();
  const [record, setRecord] = useState<HealthRecord | null | undefined>(undefined);

  useEffect(() => {
    getRecord(recordId).then(setRecord);
  }, [recordId, getRecord]);

  useEffect(() => {
    if (record === null) router.back();
  }, [record, router]);

  if (record === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!record) return null;

  return <RecordFormScreen petId={id} record={record} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
