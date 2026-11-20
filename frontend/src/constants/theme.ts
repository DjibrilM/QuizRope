export const FONTS = {
  heading: 'LuckiestGuy_400Regular',
  accent: 'Bungee_400Regular',
  body: 'Nunito_400Regular',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
  bodyBlack: 'Nunito_900Black',
} as const;

export const FORTNITE_COLORS = {
  bgDark: '#0D0B14',
  bgCard: '#1A1520',
  bgMid: '#231C2B',

  gradientStart: '#E85D75',
  gradientMid: '#9B59B6',
  gradientEnd: '#6C5CE7',

  ctaYellow: '#FFD93D',
  ctaDark: '#CA8A04',
  ctaGlow: '#FDE047',

  textPrimary: '#FFFFFF',
  textSecondary: '#B8A9C9',
  textMuted: '#7B6B8A',

  glowPink: '#E85D75',
  glowPurple: '#9B59B6',
  glowYellow: '#FFD93D',

  teamRed: '#EF4444',
  teamBlue: '#3B82F6',
} as const;

export const GRADIENTS = {
  heroBg: {
    colors: ['#0D0B14', '#1A1028', '#0D0B14'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  buttonPrimary: {
    colors: ['#E85D75', '#9B59B6'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  buttonCta: {
    colors: ['#FFD93D', '#F59E0B'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
} as const;

export const SHADOWS = {
  glowPink: {
    shadowColor: '#E85D75',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  glowPurple: {
    shadowColor: '#9B59B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  glowYellow: {
    shadowColor: '#FFD93D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  cardSubtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  textGlowYellow: {
    textShadowColor: 'rgba(255, 217, 61, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 15,
  },
} as const;

export const ANIMATION = {
  staggerDelay: 80,
  bounceDamping: 12,
  confettiCount: 40,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
} as const;

/**
 * Refined design tokens for the UI refactor: solid layered dark surfaces,
 * crisp neutral ink hierarchy, and concentric border radii.
 */
export const UI_COLORS = {
  bg: '#0D0B14',
  surface: '#161221',
  surfaceSubtle: '#1E182B',
  surfaceElevated: '#261F36',

  primary: '#6C5CE7',
  primaryPressed: '#5B4BD6',
  primarySoft: 'rgba(108, 92, 231, 0.14)',

  coral: '#E85D75',
  mint: '#34D399',
  amber: '#FBBF24',

  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6E6480',
  textOnPrimary: '#FFFFFF',
  textSubtleOnPrimary: 'rgba(255, 255, 255, 0.85)',

  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderActive: 'rgba(255, 255, 255, 0.24)',
  insetTopHighlight: 'rgba(255, 255, 255, 0.36)',
  iconWell: '#1E182B',
  iconWellSelected: 'rgba(255, 255, 255, 0.18)',
} as const;

export const UI_RADII = {
  pill: 999,
  cardLg: 28,
  card: 24,
  tile: 18,
  iconWell: 16,
  badge: 14,
} as const;

export const UI_SPACING = {
  screenX: 16,
  cardPad: 16,
  gapSm: 8,
  gapMd: 12,
  gapLg: 20,
  gapXl: 28,
} as const;

export const UI_SHADOWS = {
  primaryGlow: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  },
  subtleLift: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;
