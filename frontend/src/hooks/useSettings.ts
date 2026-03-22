import { useState, useEffect, useCallback } from 'react';
import { SettingsUpdate } from '@/types';
import { api } from '@/services/api';

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: SettingsUpdate): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.updateSettings(updates);
      setSettings((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, error, fetchSettings, updateSettings };
}