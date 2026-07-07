import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Writes `payload` as pretty-printed JSON to a cache file and hands it to the
// native share sheet (PRD 7.6). Returns false if sharing isn't available on
// this platform/device rather than throwing.
export async function exportJson(filenameStem: string, payload: unknown): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true });

  const file = new File(dir, `${filenameStem}-${Date.now()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export pet records',
  });
  return true;
}
