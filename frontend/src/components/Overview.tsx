import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useMetrics } from '@/hooks/useMetrics';
import { useLogs } from '@/hooks/useLogs';
import { LogEntry } from '@/types';

export const Overview: React.FC = () => {
  const { overview, offenders, loading: metricsLoading } = useMetrics();
  const { logs, updateFilters, loading: logsLoading } = useLogs();
  const [riskData, setRiskData] = useState<{ score: number; count: number }[]>([]);

  // Fetch recent logs for risk distribution (sample up to 1000)
  useEffect(() => {
    const fetchSample = async () => {
      try {
        // We'll reuse the logs hook's underlying api but we can't directly access; maybe call again
        // We'll do a quick fetch using the api directly
        const { api } = await import('@/services/api');
        const resp = await api.searchLogs({ limit: 1000 }) as any;
        const logs = resp.logs as LogEntry[];
        const counts: Record<number, number> = {};
        logs.forEach(l => {
          const bucket = Math.floor(l.risk_score / 10) * 10;
          counts[bucket] = (counts[bucket] || 0) + 1;
        });
        const data = Object.entries(counts).map(([score, count]) => ({
          score: Number(score),
          count,
        })).sort((a, b) => a.score - b.score);
        setRiskData(data);
      } catch (e) {
        console.error('Failed to load risk distribution', e);
      }
    };
    fetchSample();
  }, []);

  const pieData = overview
    ? [
        { name: 'Allow', value: overview.allow_percent, color: '#10b981' },
        { name: 'Block', value: overview.block_percent, color: '#ef4444' },
        { name: 'Challenge', value: overview.challenge_percent, color: '#f59e0b' },
      ]
    : [];

  const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

  // Real-time event stream: show latest block events (from logs)
  const blockLogs = logs.filter(l => l.verdict === 'block').slice(0, 10);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Overview</h2>

      {/* RPS */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Requests Per Second</h3>
        {metricsLoading ? (
          <p>Loading...</p>
        ) : (
          <p className="text-4xl font-bold text-primary-600">{overview?.rps.toFixed(1) || 0}</p>
        )}
      </div>

      {/* Percentages and Top Offenders side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Verdict Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Offenders */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top 5 Offender IPs (Last Hour)</h3>
          {metricsLoading ? (
            <p>Loading...</p>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left">IP</th>
                  <th className="text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {offenders.map((off) => (
                  <tr key={off.ip}>
                    <td className="py-2">{off.ip}</td>
                    <td className="text-right">{off.count}</td>
                  </tr>
                ))}
                {offenders.length === 0 && (
                  <tr>
                    <td colSpan={2} className="py-2 text-gray-500">No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Risk Distribution */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Risk Score Distribution (Sample)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={riskData}>
            <XAxis dataKey="score" label={{ value: 'Score (bucket)', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Real-time Event Stream */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Latest Block Events</h3>
        {logsLoading ? (
          <p>Loading...</p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {blockLogs.map((log) => (
              <li key={log.id} className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="flex justify-between">
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-300">{log.timestamp}</span>
                  <span className="text-red-600 font-bold">BLOCK</span>
                </div>
                <div>IP: {log.ip}</div>
                <div>Endpoint: {log.method} {log.endpoint}</div>
                <div>Risk Score: {log.risk_score}</div>
                {log.rule_triggers && log.rule_triggers.length > 0 && (
                  <div className="text-xs text-gray-500">Triggers: {log.rule_triggers.join(', ')}</div>
                )}
              </li>
            ))}
            {blockLogs.length === 0 && <p className="text-gray-500">No block events yet.</p>}
          </ul>
        )}
      </div>
    </div>
  );
};