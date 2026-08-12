const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const BACKUP_FILENAME = 'expense-tracker-backup.json';

async function findBackupFile(accessToken: string): Promise<string | null> {
  const res = await fetch(
    `${DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const file = data.files?.find((f: { name: string }) => f.name === BACKUP_FILENAME);
  return file?.id ?? null;
}

export async function uploadBackup(accessToken: string, content: string): Promise<void> {
  const existingId = await findBackupFile(accessToken);

  const metadata = existingId
    ? { name: BACKUP_FILENAME }
    : { name: BACKUP_FILENAME, parents: ['appDataFolder'] };

  const boundary = 'expense_tracker_backup_boundary';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: text/plain\r\n\r\n' +
    content +
    `\r\n--${boundary}--`;

  const url = existingId
    ? `${DRIVE_UPLOAD_URL}/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
}

export async function downloadBackup(accessToken: string): Promise<string | null> {
  const fileId = await findBackupFile(accessToken);
  if (!fileId) return null;

  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Drive download failed');
  }

  return res.text();
}

export async function getBackupInfo(
  accessToken: string
): Promise<{ modifiedTime: string } | null> {
  const res = await fetch(
    `${DRIVE_FILES_URL}?spaces=appDataFolder&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const file = data.files?.find((f: { name: string }) => f.name === BACKUP_FILENAME);
  return file ? { modifiedTime: file.modifiedTime } : null;
}