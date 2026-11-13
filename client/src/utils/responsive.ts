import { Dimensions } from 'react-native';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Static rendering can initialize window dimensions to zero. Reading and
// caching them at module load collapses buttons for the entire session.
function windowSize() {
  const { width, height } = Dimensions.get('window');
  return {
    width: Number.isFinite(width) && width > 0 ? width : BASE_WIDTH,
    height: Number.isFinite(height) && height > 0 ? height : BASE_HEIGHT,
  };
}

export function scale(size: number) {
  return (windowSize().width / BASE_WIDTH) * size;
}

export function verticalScale(size: number) {
  return (windowSize().height / BASE_HEIGHT) * size;
}

export function moderateScale(size: number, factor = 0.5) {
  return size + (scale(size) - size) * factor;
}
