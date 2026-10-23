import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { TextField } from './TextField';
import { AppColors } from '@/constants/colors';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

export type SelectOption<T extends string | number> = { label: string; value: T };

type Props<T extends string | number> = {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  /** Show a search box. Defaults to true when there are more than 8 options. */
  searchable?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Replacement for the native <Picker>. The chosen label is ALWAYS drawn by us
 * (in the theme text colour), so it can never turn invisible on some phones.
 */
export function SelectField<T extends string | number>({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  title,
  disabled,
  searchable,
  style,
}: Props<T>) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled, style]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
      >
        <AppText
          style={[styles.fieldText, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </AppText>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        {/* Searchable lists sit near the top so the keyboard never covers them */}
        <View style={[styles.overlay, showSearch ? styles.overlayTop : styles.overlayCenter]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
          <View style={[styles.panel, { maxHeight: height * (showSearch ? 0.5 : 0.7) }]}>
            {title ? <AppText style={styles.title}>{title}</AppText> : null}
            {showSearch && (
              <TextField
                style={styles.search}
                placeholder="Search"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
            )}
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => {
                      onChange(item.value);
                      close();
                    }}
                  >
                    <AppText style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {item.label}
                    </AppText>
                    {isSelected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<AppText style={styles.empty}>No matches</AppText>}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: c.inputBg,
    },
    fieldDisabled: { opacity: 0.5 },
    fieldText: { flex: 1, fontSize: 15, marginRight: 8 },
    placeholder: { color: c.textMuted },
    overlay: { flex: 1, backgroundColor: c.overlay, paddingHorizontal: 24 },
    overlayCenter: { justifyContent: 'center' },
    overlayTop: { justifyContent: 'flex-start', paddingTop: 72 },
    panel: {
      backgroundColor: c.card,
      borderRadius: 12,
      paddingVertical: 8,
      overflow: 'hidden',
    },
    title: { fontSize: 15, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 10 },
    search: {
      marginHorizontal: 12,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    optionText: { fontSize: 15 },
    optionTextSelected: { fontWeight: '700', color: c.primary },
    empty: { textAlign: 'center', color: c.textMuted, padding: 16 },
  });
