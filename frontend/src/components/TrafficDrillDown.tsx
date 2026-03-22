import React, { useState, useCallback } from 'react';
import { useLogs } from '@/hooks/useLogs';
import { LogEntry } from '@/types';
import { format } from 'date-fns';

export const TrafficDrillDown: React.FC = () => {
  const { logs, total, loading, error, updateFilters, searchParams, loadMore } = useLogs();
  const [localFilters, setLocalFilters] = useState({
    ip: '',
    user_agent: '',
    endpoint: '',
    verdict: '',
    start: '',
    end: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({
      ip: localFilters.ip || undefined,
      // Note: backend currently does not support user_agent/endpoint filters
      // we keep them for future use
      start: localFilters.start || undefined,
      end: localFilters.end || undefined,
      verdict: (localFilters.verdict as 'allow' | 'block' | 'challenge') || undefined,
      limit: 50,
      offset: 0,
    });
  };

  const exportCSV = useCallback(() => {
    const headers = ['ID', 'Timestamp', 'IP', 'User Agent', 'Endpoint', 'Method', 'Risk Score', 'Verdict', 'Rule Triggers'];
    const rows = logs.map(log => [
      log.id,
      log.timestamp,
      log.ip,
      log.user_agent || '',
      log.endpoint,
      log.method,
      log.risk_score,
      log.verdict,
      (log.rule_triggers || []).join(';')
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Traffic Drill-Down</h2>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">IP Address</label>
            <input
              type="text"
              value={localFilters.ip}
              onChange={(e) => setLocalFilters({ ...localFilters, ip: e.target.value })}
              placeholder="192.168.1.1"
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Verdict</label>
            <select
              value={localFilters.verdict}
              onChange={(e) => setLocalFilters({ ...localFilters, verdict: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Any</option>
              <option value="allow">Allow</option>
              <option value="block">Block</option>
              <option value="challenge">Challenge</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="datetime-local"
              value={localFilters.start}
              onChange={(e) => setLocalFilters({ ...localFilters, start: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="datetime-local"
              value={localFilters.end}
              onChange={(e) => setLocalFilters({ ...localFilters, end: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        {/* Advanced fields that may not be supported by backend yet */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
          >
            {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">User-Agent (client-side only)</label>
                <input
                  type="text"
                  value={localFilters.user_agent}
                  onChange={(e) => setLocalFilters({ ...localFilters, user_agent: e.target.value })}
                  placeholder="Mozilla/5.0 ..."
                  className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Endpoint (client-side only)</label>
                <input
                  type="text"
                  value={localFilters.endpoint}
                  onChange={(e) => setLocalFilters({ ...localFilters, endpoint: e.target.value })}
                  placeholder="/api/*"
                  className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Note: User-Agent and Endpoint filters are not yet supported by the backend and are applied client-side on the current page of results.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Total results: {total}</span>
        </div>
      </form>

      {error && <div className="text-red-600 bg-red-100 p-3 rounded">{error}</div>}

      {/* Export Buttons */}
      <div className="flex space-x-4">
        <button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded">
          Export CSV
        </button>
        <button onClick={exportJSON} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
          Export JSON
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-left py-3 px-4">ID</th>
              <th className="text-left py-3 px-4">Timestamp</th>
              <th className="text-left py-3 px-4">IP</th>
              <th className="text-left py-3 px-4 hidden md:table-cell">User-Agent</th>
              <th className="text-left py-3 px-4">Endpoint</th>
              <th className="text-left py-3 px-4">Method</th>
              <th className="text-right py-3 px-4">Risk</th>
              <th className="text-left py-3 px-4">Verdict</th>
              <th className="text-left py-3 px-4">Triggers</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="py-3 px-4">{log.id}</td>
                <td className="py-3 px-4 text-sm">{format(new Date(log.timestamp), 'PPpp')}</td>
                <td className="py-3 px-4 font-mono text-sm">{log.ip}</td>
                <td className="py-3 px-4 text-sm truncate max-w-xs hidden md:table-cell" title={log.user_agent || ''}>
                  {log.user_agent || '-'}
                </td>
                <td className="py-3 px-4">{log.endpoint}</td>
                <td className="py-3 px-4 font-mono">{log.method}</td>
                <td className="py-3 px-4 text-right font-bold" style={{ color: log.risk_score > 80 ? '#ef4444' : log.risk_score > 50 ? '#f59e0b' : '#10b981' }}>
                  {log.risk_score}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    log.verdict === 'allow' ? 'bg-green-100 text-green-800' :
                    log.verdict === 'block' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {log.verdict}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">
                  {log.rule_triggers && log.rule_triggers.length > 0 ? (
                    <ul className="list-disc list-inside">
                      {log.rule_triggers.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  ) : '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-gray-500">No log entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {nextOffset && (
        <div className="flex justify-center mt-4">
          <button onClick={loadMore} disabled={loading} className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded disabled:opacity-50">
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Client-side Filtering Note */}
      {showAdvanced && (localFilters.user_agent || localFilters.endpoint) && (
        <div className="text-sm text-yellow-600 bg-yellow-100 p-3 rounded">
          Note: User-Agent and Endpoint filters are applied locally to the currently loaded page. For full filtering, backend support is required.
        </div>
      )}
    </div>
  );
};