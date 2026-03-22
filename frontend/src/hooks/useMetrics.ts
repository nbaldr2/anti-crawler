import { useState, useEffect, useCallback } from 'react';
import { MetricsOverview, TopOffender } from '@/types';
import { api } from '@/services/api';
import { wsService } from '@/services/websocket';

export function useMetrics() {
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [offenders, setOffenders] = useState<TopOffender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await api.metricsOverview();
      setOverview(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const fetchOffenders = useCallback(async () => {
    try {
      const data = await api.topOffenders(5);
      setOffenders(data.offenders);
    } catch (err) {
      console.error('Failed to fetch offenders', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchOffenders()]);
      setLoading(false);
    };
    init();
  }, [fetchOverview, fetchOffenders]);

  // WebSocket subscription
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === 'metrics_update') {
        setOverview(msg.data);
      }
    };

    const unsubscribe = wsService.subscribe(handleMessage);
    return unsubscribe;
  }, []);

  // Polling fallback: if WebSocket not connected, poll overview every 2s
  useEffect(() => {
    if (wsService.isConnected()) return;
    const interval = setInterval(() => {
      fetchOverview();
      // Offenders cache less frequently
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  return { overview, offenders, loading, error, refresh: () => Promise.all([fetchOverview(), fetchOffenders()]) };
}