import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  borderStrong: string;
  accent: string;
  onAccent: string;
  gold: string;
  danger: string;
  success: string;
  successBg: string;
  shelfBack: string;
  plank: string;
  plankLight: string;
  overlay: string;
};

const light: Theme = {
  dark: false,
  bg: '#F5ECD9',
  surface: '#FBF4E6',
  card: '#EFE3CC',
  text: '#3B2A1A',
  textSecondary: '#8A6E4B',
  muted: '#A08560',
  border: '#D9C7A3',
  borderStrong: '#B89B70',
  accent: '#5C3A1E',
  onAccent: '#F5ECD9',
  gold: '#B8862B',
  danger: '#9C4A2A',
  success: '#4F6B2E',
  successBg: '#E3E6C8',
  shelfBack: '#E6D3B0',
  plank: '#9A6634',
  plankLight: '#C08A52',
  overlay: 'rgba(59,42,26,0.45)',
};

const dark: Theme = {
  dark: true,
  bg: '#1E1712',
  surface: '#2A2018',
  card: '#2E2219',
  text: '#EDE0C8',
  textSecondary: '#A8916E',
  muted: '#6E5A42',
  border: '#3A2C20',
  borderStrong: '#5A4836',
  accent: '#C9A46A',
  onAccent: '#2A1A0C',
  gold: '#D9A441',
  danger: '#D9785A',
  success: '#A8C27A',
  successBg: '#2F3522',
  shelfBack: '#2E2219',
  plank: '#6B4423',
  plankLight: '#8E6238',
  overlay: 'rgba(0,0,0,0.55)',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const fonts = {
  serif: 'Lora_400Regular',
  serifItalic: 'Lora_400Regular_Italic',
  serifMedium: 'Lora_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
};
