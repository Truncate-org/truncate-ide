import { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export function useUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date,
          body: update.body,
        });
        return update;
      }
    } catch (e) {
      console.error('Failed to check for updates:', e);
      setError(e instanceof Error ? e.message : String(e));
    }
    return null;
  };

  const installUpdate = async () => {
    setIsUpdating(true);
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      console.error('Failed to install update:', e);
      setError(e instanceof Error ? e.message : String(e));
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  return {
    updateAvailable,
    updateInfo,
    isUpdating,
    error,
    installUpdate,
    dismissUpdate: () => setUpdateAvailable(false)
  };
}
