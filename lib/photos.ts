import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

// Copies a picked/captured image (a cache/tmp URI from expo-image-picker) into
// a permanent app-sandbox subdirectory and returns the durable file:// URI to
// store on the Pet/HealthRecord row.
export function persistPhoto(sourceUri: string, subdir: 'pets' | 'records'): string {
  const dir = new Directory(Paths.document, subdir);
  if (!dir.exists) dir.create({ intermediates: true });

  const src = new File(sourceUri);
  const dest = new File(dir, `${Crypto.randomUUID()}${src.extension || '.jpg'}`);
  src.copy(dest);
  return dest.uri;
}

// Best-effort cleanup; a missing/already-deleted file should never crash a save/delete flow.
export function deletePhotoIfExists(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ignore — file may already be gone or the URI may be from an old sandbox path
  }
}
