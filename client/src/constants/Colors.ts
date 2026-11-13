// Shared brand accents stay cheerful in both appearance modes.
export const Brand = {
  teal: '#087F8C', deepTeal: '#075866', ink: '#153B43',
  sunshine: '#FFD166', sunshineLight: '#FFF0C7',
  coral: '#F58365', coralLight: '#FFE7DC',
  mint: '#BDE8D7', mintLight: '#E5F6EF', paper: '#F7F5EF',
};

export const LightColors = {
  primary: '#087F8C',
  primaryDark: '#06626D',
  primaryLight: '#087F8C',
  secondary: '#FFD166',
  secondaryDark: '#E9B84A',
  accent: '#D86749',
  background: '#FFFFFF',
  backgroundAlt: '#F7F5EF',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',
  card: '#FFFFFF',
  text: '#242424',
  textSecondary: '#595959',
  textTertiary: '#6B6B6B',
  textInverse: '#FFFFFF',
  border: '#DCE8E5',
  borderLight: '#EAF0EC',
  borderFocused: '#087F8C',
  error: '#C0392B',
  success: '#06626D',
  warning: '#B8860B',
  overlay: 'rgba(13, 31, 22, 0.5)',
  gradientStart: '#0996A1',
  gradientEnd: '#075866',
  onPrimary: '#FFFFFF',
  accentSurface: '#FFF0C7',
  onAccent: '#654715',
  mintSurface: '#E5F6EF',
  coralSurface: '#FFE7DC',
  heroStart: '#FFE8A3', heroEnd: '#FFD166', heroText: '#153B43', heroSubtext: '#68582E',
  deepForest: '#153B43',
  pineShade: '#073A44',
  emeraldDepth: '#064851',
  mossGreen: '#06626D',
  botanicalGreen: '#087F8C',
  softFern: '#29A8AD',
  sageLeaf: '#64C9C7',
  oliveMist: '#A8DEDA',
  lindenGreen: '#C8EDE6',
  pistachioCream: '#E5F6F1',
};

export const DarkColors = {
  primary: '#087F8C', primaryDark: '#06626D', primaryLight: '#71DEDA',
  secondary: '#D6A733', secondaryDark: '#A37A13', accent: '#F5B867',
  background: '#181A19', backgroundAlt: '#202221', surface: '#181A19',
  surfaceElevated: '#303030', card: '#222222',
  text: '#F5F5F5', textSecondary: '#C2C2C2', textTertiary: '#A3A3A3', textInverse: '#181818',
  border: '#383C39', borderLight: '#303330', borderFocused: '#71DEDA',
  error: '#FF8A80', success: '#71DEDA', warning: '#F5CA6C', overlay: 'rgba(0,0,0,0.7)',
  gradientStart: '#0996A1', gradientEnd: '#075866', onPrimary: '#FFFFFF',
  accentSurface: '#55400A', onAccent: '#FFE3A0', mintSurface: '#12392D', coralSurface: '#542500',
  heroStart: '#705300', heroEnd: '#594200', heroText: '#FFF2D1', heroSubtext: '#E0CFA4',
  deepForest: '#181A19', pineShade: '#202221', emeraldDepth: '#71DEDA', mossGreen: '#71DEDA',
  botanicalGreen: '#71DEDA', softFern: '#71DEDA', sageLeaf: '#BDE8D7', oliveMist: '#A3A3A3',
  lindenGreen: '#404040', pistachioCream: '#F5F5F5',
};

export type BrandPalette = typeof Brand;
export const DarkBrand: BrandPalette = {
  ...Brand,
  sunshine: '#D6A733', sunshineLight: '#55400A', coralLight: '#542500',
  mintLight: '#12392D', paper: '#181A19',
};
export type ThemeColors = typeof LightColors;

export const Colors = LightColors;
