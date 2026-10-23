import { TextInput, TextInputProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Drop-in replacement for <TextInput> with explicit colours, so typed text is
 * always visible (no white-on-white / black-on-black) in every theme.
 */
export function TextField({ style, maxFontSizeMultiplier = 1.3, ...rest }: TextInputProps) {
  const { colors, scheme } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      keyboardAppearance={scheme}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ color: colors.text, backgroundColor: colors.inputBg }, style]}
      {...rest}
    />
  );
}
