import { ComponentProps } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = ComponentProps<typeof KeyboardAwareScrollView>;

/**
 * ScrollView for form screens. Scrolls the focused input above the keyboard
 * (works with Android edge-to-edge, where the old behaviour no longer
 * resizes the window) and keeps taps working while the keyboard is open.
 */
export function FormScrollView({ contentContainerStyle, bottomOffset = 96, ...rest }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps="handled"
      bottomOffset={bottomOffset}
      contentContainerStyle={[{ paddingBottom: insets.bottom + 24 }, contentContainerStyle]}
      {...rest}
    />
  );
}
