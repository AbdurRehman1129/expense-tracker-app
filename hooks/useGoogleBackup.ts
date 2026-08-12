import { useState, useEffect, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { exportAllData, importAllData } from '@/db/backup';
import { uploadBackup, downloadBackup, getBackupInfo } from '@/utils/googleDrive';
import { deriveKey, encryptData, decryptData } from '@/utils/backupCrypto';
import { setSetting, getSetting } from '@/db/settings';

WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = '620923567533-bumf1j1pv0tesb2ig3ju2ebvud483kj6.apps.googleusercontent.com';
const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'openid', 'profile'];

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const REFRESH_TOKEN_KEY = 'google_refresh_token';

export function useGoogleBackup() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleUserId, setGoogleUserId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const androidClientPrefix = ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '');

  const redirectUri = AuthSession.makeRedirectUri({
    native: `com.googleusercontent.apps.${androidClientPrefix}:/oauth2redirect`,
  });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: ANDROID_CLIENT_ID,
      scopes: SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  const fetchUserId = useCallback(async (token: string) => {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const info = await res.json();
    return info.sub as string;
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    try {
      const tokenResult = await AuthSession.refreshAsync(
        { clientId: ANDROID_CLIENT_ID, refreshToken },
        discovery
      );
      setAccessToken(tokenResult.accessToken);
      const uid = await fetchUserId(tokenResult.accessToken);
      setGoogleUserId(uid);
      setSignedIn(true);
      return tokenResult.accessToken;
    } catch {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      setSignedIn(false);
      return null;
    }
  }, [fetchUserId]);

  // Try to restore session silently on mount
  useEffect(() => {
    refreshAccessToken();
  }, [refreshAccessToken]);

  const signIn = useCallback(async () => {
    if (!request) return false;
    const result = await promptAsync();
    if (result.type !== 'success' || !result.params.code) return false;

    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: ANDROID_CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier ?? '' },
      },
      discovery
    );

    setAccessToken(tokenResult.accessToken);
    if (tokenResult.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResult.refreshToken);
    }
    const uid = await fetchUserId(tokenResult.accessToken);
    setGoogleUserId(uid);
    setSignedIn(true);
    return true;
  }, [request, promptAsync, redirectUri, fetchUserId]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setGoogleUserId(null);
    setSignedIn(false);
  }, []);

  const backupNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!accessToken || !googleUserId) {
      return { success: false, message: 'Please sign in with Google first.' };
    }
    setBusy(true);
    try {
      const json = await exportAllData();
      const key = deriveKey(googleUserId);
      const encrypted = encryptData(json, key);
      await uploadBackup(accessToken, encrypted);
      await setSetting('last_backup_at', new Date().toISOString());
      return { success: true, message: 'Backup completed successfully.' };
    } catch (err) {
      console.error('Backup failed:', err);
      return { success: false, message: 'Backup failed. Please try again.' };
    } finally {
      setBusy(false);
    }
  }, [accessToken, googleUserId]);

  const restoreNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!accessToken || !googleUserId) {
      return { success: false, message: 'Please sign in with Google first.' };
    }
    setBusy(true);
    try {
      const encrypted = await downloadBackup(accessToken);
      if (!encrypted) {
        return { success: false, message: 'No backup found on Google Drive.' };
      }
      const key = deriveKey(googleUserId);
      const json = decryptData(encrypted, key);
      await importAllData(json);
      return { success: true, message: 'Data restored successfully.' };
    } catch (err) {
      console.error('Restore failed:', err);
      return { success: false, message: 'Restore failed. The backup may be corrupted.' };
    } finally {
      setBusy(false);
    }
  }, [accessToken, googleUserId]);

  const checkRemoteBackupInfo = useCallback(async () => {
    if (!accessToken) return null;
    return getBackupInfo(accessToken);
  }, [accessToken]);

  return {
    signedIn,
    busy,
    signIn,
    signOut,
    backupNow,
    restoreNow,
    checkRemoteBackupInfo,
  };
}