import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export function scale(size: number) {
  return (width / BASE_WIDTH) * size;
}

export function verticalScale(size: number) {
  return (height / BASE_HEIGHT) * size;
}

export function moderateScale(size: number, factor = 0.5) {
  return size + (scale(size) - size) * factor;
}
