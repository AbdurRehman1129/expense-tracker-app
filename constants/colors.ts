/**
 * App colour tokens. Every screen reads colours from here (via useTheme /
 * useThemedStyles) so Light, Dark and System modes all look right.
 *
 * Brand colours used on coloured cards with white text (green income, red
 * expense, purple zakat, cyan sadqa ...) are intentionally NOT tokens: they
 * work on both backgrounds.
 */
export const lightColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceAlt: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  inputBg: '#FFFFFF',
  primary: '#2563EB',
  primaryText: '#FFFFFF',
  success: '#16A34A',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  warning: '#F59E0B',
  tabBar: '#FFFFFF',
  tabInactive: '#6B7280',
  overlay: 'rgba(0,0,0,0.4)',
};

export type AppColors = typeof lightColors;

export const darkColors: AppColors = {
  background: '#0B0F14',
  surface: '#151B23',
  surfaceAlt: '#1E2630',
  card: '#151B23',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  border: '#2B3541',
  inputBg: '#1E2630',
  primary: '#60A5FA',
  primaryText: '#0B0F14',
  success: '#4ADE80',
  danger: '#F87171',
  dangerBg: '#3B1D1D',
  warning: '#FBBF24',
  tabBar: '#0F141A',
  tabInactive: '#9CA3AF',
  overlay: 'rgba(0,0,0,0.6)',
};
