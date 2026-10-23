import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from './AppText';
import { Button } from './Button';
import { FormScrollView } from './FormScrollView';
import { AppColors } from '@/constants/colors';
import { useThemedStyles } from '@/contexts/ThemeContext';

type Props = {
  loading: boolean;
  missing: boolean;
  saving: boolean;
  onSave: () => void;
  onDelete?: () => void;
  /** When set, the form is shown without Save/Delete (e.g. automatic entries). */
  readOnlyNotice?: string;
  children: ReactNode;
};

/** Common frame for every edit screen: loading / not-found states, Save and Delete buttons. */
export function EditScaffold({ loading, missing, saving, onSave, onDelete, readOnlyNotice, children }: Props) {
  const styles = useThemedStyles(makeStyles);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (missing) {
    return (
      <View style={styles.center}>
        <AppText style={styles.message}>This entry no longer exists.</AppText>
        <Button title="Go back" variant="ghost" onPress={() => router.back()} style={styles.backButton} />
      </View>
    );
  }

  return (
    <FormScrollView style={styles.container} contentContainerStyle={styles.content}>
      {readOnlyNotice ? <AppText style={styles.notice}>{readOnlyNotice}</AppText> : null}
      {children}
      {!readOnlyNotice && (
        <View style={styles.buttons}>
          <Button title="Save Changes" onPress={onSave} loading={saving} />
          {onDelete && <Button title="Delete" variant="danger" onPress={onDelete} disabled={saving} />}
        </View>
      )}
    </FormScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background, padding: 24 },
    message: { fontSize: 16, color: c.textMuted, marginBottom: 16 },
    backButton: { alignSelf: 'stretch' },
    notice: {
      backgroundColor: c.surface,
      color: c.textMuted,
      borderRadius: 8,
      padding: 12,
      fontSize: 13,
      lineHeight: 18,
    },
    buttons: { marginTop: 24, gap: 12 },
  });
