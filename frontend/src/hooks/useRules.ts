import { useState, useEffect, useCallback } from 'react';
import { RuleResponse, RuleCreate, RuleUpdate } from '@/types';
import { api } from '@/services/api';

export function useRules() {
  const [rules, setRules] = useState<RuleResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listRules();
      setRules(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (rule: RuleCreate): Promise<RuleResponse> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.createRule(rule);
      setRules((prev) => [...prev, data]);
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateRule = async (id: string, updates: RuleUpdate): Promise<RuleResponse> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.updateRule(id, updates);
      setRules((prev) => prev.map(r => r.id === id ? data : r));
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteRule = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await api.deleteRule(id);
      setRules((prev) => prev.filter(r => r.id !== id));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { rules, loading, error, fetchRules, createRule, updateRule, deleteRule };
}