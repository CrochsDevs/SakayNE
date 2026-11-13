import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = '@sakayne_language';
export type AppLanguage = 'en' | 'fil';

export async function getLanguage(): Promise<AppLanguage> {
  const code = await AsyncStorage.getItem(LANG_KEY);
  return code === 'fil' ? 'fil' : 'en';
}

export async function setLanguage(code: AppLanguage) {
  await AsyncStorage.setItem(LANG_KEY, code);
}
