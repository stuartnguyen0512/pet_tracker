import { useLocalSearchParams } from 'expo-router';
import { RecordFormScreen } from '../../../../components/RecordFormScreen';

export default function NewRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecordFormScreen petId={id} />;
}
