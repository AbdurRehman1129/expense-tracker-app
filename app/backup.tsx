import { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useGoogleBackup } from '@/contexts/GoogleBackupContext';
import { getSetting, setSetting } from '@/db/settings';
import { AppText } from '@/components/ui/AppText';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { AppColors } from '@/constants/colors';

export default function BackupScreen() {
  const styles = useThemedStyles(makeStyles);
  const { signedIn, authLoading, busy, signIn, signOut, backupNow, restoreNow, checkRemoteBackupInfo } =
  useGoogleBackup();

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [remoteModified, setRemoteModified] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    const enabled = await getSetting('backup_enabled');
    setAutoBackupEnabled(enabled === 'true');
    const last = await getSetting('last_backup_at');
    setLastBackupAt(last);

    if (signedIn) {
      const info = await checkRemoteBackupInfo();
      setRemoteModified(info?.modifiedTime ?? null);
    }
  }, [signedIn, checkRemoteBackupInfo]);

  useFocusEffect(
    useCallback(() => {
      loadInfo();
    }, [loadInfo])
  );

  const handleToggleAutoBackup = async (value: boolean) => {
    setAutoBackupEnabled(value);
    await setSetting('backup_enabled', value ? 'true' : 'false');
  };

  const handleBackup = async () => {
    const result = await backupNow();
    Alert.alert(result.success ? 'Success' : 'Failed', result.message);
    loadInfo();
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore from Backup?',
      'This will replace all current data on this device with the data from your Google Drive backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            const result = await restoreNow();
            Alert.alert(result.success ? 'Success' : 'Failed', result.message);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <AppText style={styles.sectionTitle}>Google Account</AppText>
        {authLoading ? (
          <ActivityIndicator />
        ) : signedIn ? (
          <>
            <AppText style={styles.statusText}>✓ Signed in</AppText>
            <TouchableOpacity style={styles.secondaryButton} onPress={signOut}>
              <AppText style={styles.secondaryButtonText}>Sign Out</AppText>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={signIn}>
            <AppText style={styles.primaryButtonText}>Sign in with Google</AppText>
          </TouchableOpacity>
        )}
      </View>

      {signedIn && (
        <>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <AppText style={styles.sectionTitle}>Auto-Backup</AppText>
              <Switch value={autoBackupEnabled} onValueChange={handleToggleAutoBackup} />
            </View>
            <AppText style={styles.hint}>
              When enabled, your data backs up automatically once per day when you open the app.
            </AppText>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Manual Backup</AppText>
            <AppText style={styles.hint}>
              Last backup from this device: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Never'}
            </AppText>
            <AppText style={styles.hint}>
              Latest backup on Drive: {remoteModified ? new Date(remoteModified).toLocaleString() : 'None found'}
            </AppText>
            <TouchableOpacity style={styles.primaryButton} onPress={handleBackup} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryButtonText}>Backup Now</AppText>}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Restore</AppText>
            <AppText style={styles.hint}>
              Restores all data from your Google Drive backup, replacing what&apos;s on this device.
            </AppText>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#dc2626' }]} onPress={handleRestore} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryButtonText}>Restore from Backup</AppText>}
            </TouchableOpacity>
          </View>
        </>
      )}

      <AppText style={styles.footnote}>
        Your data is encrypted before it&apos;s uploaded and stored in a private app-only space in your Google Drive — not visible in your regular Drive files.
      </AppText>
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    card: { backgroundColor: c.surface, borderRadius: 10, padding: 14, marginBottom: 16 },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusText: { fontSize: 14, color: c.success, fontWeight: '600', marginBottom: 10 },
    hint: { fontSize: 12, color: c.textMuted, marginBottom: 10, lineHeight: 17 },
    primaryButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    secondaryButton: { borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
    secondaryButtonText: { color: c.textMuted, fontWeight: '600', fontSize: 13 },
    footnote: { fontSize: 11, color: c.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 30, lineHeight: 16 },
  });