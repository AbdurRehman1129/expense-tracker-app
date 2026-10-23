import { Text, TextProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Drop-in replacement for <Text>. Defaults to the theme text colour (plain
 * <Text> is black, which disappears on a dark background) and caps system
 * font scaling at 1.3x so layouts don't break on "largest font" phones.
 */
export function AppText({ style, maxFontSizeMultiplier = 1.3, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ color: colors.text }, style]}
      {...rest}
    />
  );
}
