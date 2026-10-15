import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { avatarMimeType, validateAvatarSize } from '@/utils/avatar';

export async function pickAvatar(): Promise<ArrayBuffer | null> {
  // The system image picker needs no camera or blanket photo-library permission request.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], allowsEditing: Platform.OS !== 'web', aspect: [1, 1], quality: 0.8,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || (asset.type && asset.type !== 'image')) throw Object.assign(new Error('Unsupported image'), { code: 'avatar.unsupported' });
  let buffer: ArrayBuffer;
  if (Platform.OS === 'web') {
    if (!asset.file) throw Object.assign(new Error('Unsupported image'), { code: 'avatar.unsupported' });
    validateAvatarSize(asset.file.size);
    buffer = await asset.file.arrayBuffer();
  } else {
    const file = new File(asset.uri);
    validateAvatarSize(file.size);
    buffer = await file.arrayBuffer();
  }
  avatarMimeType(buffer);
  return buffer;
}
