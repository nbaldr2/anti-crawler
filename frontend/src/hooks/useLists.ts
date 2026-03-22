import { useState, useEffect, useCallback } from 'react';
import { ListItem } from '@/types';
import { api } from '@/services/api';

type ListType = 'allowlist' | 'denylist';

export function useLists(type: ListType) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = type === 'allowlist' ? await api.listAllowlist() : await api.listDenylist();
      setItems(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (item: Omit<ListItem, 'expires_at'> & { expires_at?: string }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      if (type === 'allowlist') {
        await api.addAllowlist(item);
      } else {
        await api.addDenylist(item);
      }
      await fetchItems();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (cidr: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      if (type === 'allowlist') {
        await api.removeAllowlist(cidr);
      } else {
        await api.removeDenylist(cidr);
      }
      await fetchItems();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { items, loading, error, fetchItems, addItem, removeItem };
}