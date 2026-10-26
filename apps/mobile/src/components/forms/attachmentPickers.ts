import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export type Attachment = { uri: string; name: string; type: string; size?: number };

/** `null` means the user cancelled; an `error` is plain wording to show next to the field. */
export type PickResult = { attachment: Attachment } | { error: string } | null;

/** api-contract.md §6's real multer limits (F0.1) — 3 mimetypes, 5MB. */
export const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/** The wording to show when a picked file isn't acceptable, or `null` when it is. */
export function validateAttachment(
  attachment: Attachment,
  allowedTypes: string[] = DEFAULT_ALLOWED_TYPES,
  maxSizeBytes: number = DEFAULT_MAX_SIZE_BYTES,
): string | null {
  if (!allowedTypes.includes(attachment.type)) return 'That file type is not supported.';
  if (attachment.size && attachment.size > maxSizeBytes) return `File is larger than ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`;
  return null;
}

// Review finding (Phase 1 retro): a denied permission or a picker throwing used to silently no-op — every picker
// here returns an `error` instead, so the caller always has something to show.

/** Camera → a photo compressed to quality 0.7 (max-dimension resize deferred — no `expo-image-manipulator` pinned yet). */
export async function pickFromCamera(): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: 'Camera permission is needed to take a photo.' };
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return null;
    return { attachment: { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize } };
  } catch {
    return { error: 'Could not open the camera. Try again.' };
  }
}

export async function pickFromPhotos(): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { error: 'Photo library permission is needed to choose a photo.' };
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return null;
    return { attachment: { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize } };
  } catch {
    return { error: 'Could not open your photos. Try again.' };
  }
}

export async function pickFromFiles(allowedTypes: string[] = DEFAULT_ALLOWED_TYPES): Promise<PickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: allowedTypes, copyToCacheDirectory: true });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return null;
    return { attachment: { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? undefined } };
  } catch {
    return { error: 'Could not open Files. Try again.' };
  }
}

/** A profile photo: the camera or the photo library, always cropped to a square before it leaves the phone. */
export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<PickResult> {
  try {
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return { error: source === 'camera' ? 'Camera permission is needed to take a photo.' : 'Photo library permission is needed to choose a photo.' };
    }
    const options = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.8 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return null;
    return { attachment: { uri: asset.uri, name: asset.fileName ?? 'profile.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize } };
  } catch {
    return { error: 'Could not open your photos. Try again.' };
  }
}
