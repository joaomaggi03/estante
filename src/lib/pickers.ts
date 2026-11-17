import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/** Fotografa e deixa recortar (usado para a lombada real). */
export async function takePhoto(crop = true): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Câmera bloqueada', 'Permita o acesso à câmera nas configurações do Android.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: crop, quality: 0.8 });
  return res.canceled ? null : res.assets[0].uri;
}

export async function pickFromGallery(aspect?: [number, number]): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.8 });
  return res.canceled ? null : res.assets[0].uri;
}

/** Pergunta se a imagem vem da câmera ou da galeria. */
export function chooseImage(title: string, aspect?: [number, number]): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(title, undefined, [
      { text: 'Câmera', onPress: () => takePhoto(true).then(resolve) },
      { text: 'Galeria', onPress: () => pickFromGallery(aspect).then(resolve) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}
