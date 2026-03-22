import { useState, useEffect, useCallback, useRef } from 'react';
import { LogEntry, SearchFilters, LogSearchResponse } from '@/types';
import { api } from '@/services/api';
import { wsService } from '@/services/websocket';

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<SearchFilters>({
    limit: 50,
    offset: 0,
  });

  const lastLogIdRef = useRef<number>(0);
  const isRealTimeRef = useRef(false);

  const search = useCallback(async (params: SearchFilters, reset: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.searchLogs({
        ...params,
        limit: params.limit || 50,
        offset: reset ? 0 : nextOffset || params.offset || 0,
      } as any);
      const resp = response as LogSearchResponse;
      if (reset) {
        setLogs(resp.logs);
        lastLogIdRef.current = resp.logs[0]?.id || 0;
      } else {
        setLogs((prev) => [...prev, ...resp.logs]);
      }
      setTotal(resp.total);
      setNextOffset(resp.next_offset ?? null);
      isRealTimeRef.current = false;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [nextOffset]);

  // Initial load
  useEffect(() => {
    search(searchParams, true);
  }, []); // run once on mount

  // Real-time updates via WebSocket
  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === 'new_log') {
        const log = msg.data as LogEntry;
        // Prepend new log if it's newer
        if (log.id > lastLogIdRef.current) {
          setLogs((prev) => [log, ...prev]);
          lastLogIdRef.current = log.id;
          // If we are real-time mode, also update total? Not needed.
        }
      }
    };

    const unsub = wsService.subscribe(handleMessage);
    return () => unsub();
  }, []);

  // Polling fallback for new logs if no WebSocket
  useEffect(() => {
    if (wsService.isConnected()) return;
    const interval = setInterval(async () => {
      if (isRealTimeRef.current) {
        try {
          // Fetch the most recent logs with a small limit and compare IDs
          const resp = await api.searchLogs({ limit: 20 }) as LogSearchResponse;
          const newest = resp.logs[0];
          if (newest && newest.id > lastLogIdRef.current) {
            setLogs((prev) => {
              // Prepend only those with higher ID
              const toAdd = resp.logs.filter(l => l.id > lastLogIdRef.current);
              if (toAdd.length > 0) {
                lastLogIdRef.current = toAdd[0].id;
                return [...toAdd, ...prev];
              }
              return prev;
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadMore = useCallback(() => {
    if (!nextOffset || loading) return;
    search({ ...searchParams, offset: nextOffset }, false);
  }, [nextOffset, loading, search, searchParams]);

  const updateFilters = useCallback((newParams: Partial<SearchFilters>) => {
    const merged = { ...searchParams, ...newParams };
    setSearchParams(merged);
    search(merged, true);
  }, [searchParams, search]);

  const enableRealTime = useCallback(() => {
    isRealTimeRef.current = true;
  }, []);

  const disableRealTime = useCallback(() => {
    isRealTimeRef.current = false;
  }, []);

  return {
    logs,
    total,
    nextOffset,
    loading,
    error,
    searchParams,
    loadMore,
    updateFilters,
    enableRealTime,
    disableRealTime,
  };
}