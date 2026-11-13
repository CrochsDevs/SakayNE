import { Image } from 'react-native';

export default function BrandMark({ large = false }: { large?: boolean }) {
  return <Image
    source={require('@/assets/logo/SakayNE.png')}
    accessibilityLabel="Sakay — For Every Juan"
    resizeMode="contain"
    style={{ width: large ? 240 : 156, height: large ? 104 : 68 }}
  />;
}
