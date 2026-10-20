import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = '@sakayne_language';

export async function getLanguage(): Promise<string> {
  return (await AsyncStorage.getItem(LANG_KEY)) || 'en';
}

export async function setLanguage(code: string) {
  await AsyncStorage.setItem(LANG_KEY, code);
}
