import React, { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { TokenGenerateRequest } from '@/types';

export const Settings: React.FC = () => {
  const { settings, loading, error, updateSettings } = useSettings();
  const [tokenForm, setTokenForm] = useState<TokenGenerateRequest>({
    sub: 'admin',
    scope: ['admin'],
    rate_limit_override: undefined,
    expires_in_days: 90,
  });
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const handleUpdate = async (key: string, value: any) => {
    await updateSettings({ [key]: value });
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { api } = await import('@/services/api');
      const result = await api.generateToken(tokenForm);
      setGeneratedToken(result.token);
    } catch (err) {
      alert('Failed to generate token: ' + (err instanceof Error ? err.message : err));
    }
  };

  // Parse settings into manageable pieces
  const scoringThresholds = settings.scoring_thresholds as { low?: number; medium?: number; high?: number } || {};
  const weights = settings.weights as Record<string, number> || {};
  const rateLimit = settings.rate_limit as Record<string, any> || {};
  const powConfig = settings.pow as Record<string, number> || {};

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Settings</h2>

      {error && <div className="text-red-600 bg-red-100 p-3 rounded">{error}</div>}

      {/* Scoring Thresholds */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Scoring Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Low</label>
            <input
              type="number"
              value={scoringThresholds.low ?? ''}
              onChange={(e) => handleUpdate('scoring_thresholds', { ...scoringThresholds, low: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Medium</label>
            <input
              type="number"
              value={scoringThresholds.medium ?? ''}
              onChange={(e) => handleUpdate('scoring_thresholds', { ...scoringThresholds, medium: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">High</label>
            <input
              type="number"
              value={scoringThresholds.high ?? ''}
              onChange={(e) => handleUpdate('scoring_thresholds', { ...scoringThresholds, high: parseInt(e.target.value) || 0 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Thresholds map risk scores to actions: 0-low => allow; low-medium => rate limit; medium-high => challenge; high-100 => block.
        </p>
      </div>

      {/* Category Weights */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Category Weights (sum must be 100)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['ip_reputation', 'user_agent', 'request_pattern', 'behavioral', 'tls_fingerprint', 'headless_detection'].map(category => (
            <div key={category}>
              <label className="block text-sm font-medium mb-1 capitalize">{category.replace('_', ' ')}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={weights[category] ?? ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  updateSettings({ weights: { ...weights, [category]: val } });
                }}
                className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Rate Limit Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Rate Limit</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Burst</label>
            <input
              type="number"
              value={rateLimit.burst ?? ''}
              onChange={(e) => handleUpdate('rate_limit', { ...rateLimit, burst: parseInt(e.target.value) || 1 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Window (seconds)</label>
            <input
              type="number"
              value={rateLimit.window ?? ''}
              onChange={(e) => handleUpdate('rate_limit', { ...rateLimit, window: parseInt(e.target.value) || 1 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* PoW Settings */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Proof-of-Work</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Initial Bits</label>
            <input
              type="number"
              value={powConfig.bits ?? ''}
              onChange={(e) => handleUpdate('pow', { bits: parseInt(e.target.value) || 1 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expiry (seconds)</label>
            <input
              type="number"
              value={powConfig.expiry_seconds ?? ''}
              onChange={(e) => handleUpdate('pow', { ...powConfig, expiry_seconds: parseInt(e.target.value) || 3600 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Token Generation */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Generate Admin Token</h3>
        <form onSubmit={handleGenerateToken} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Subject (sub)</label>
            <input
              required
              type="text"
              value={tokenForm.sub}
              onChange={(e) => setTokenForm({ ...tokenForm, sub: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Scope (comma separated)</label>
            <input
              required
              type="text"
              value={tokenForm.scope.join(',')}
              onChange={(e) => setTokenForm({ ...tokenForm, scope: e.target.value.split(',').map(s => s.trim()) })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rate Limit Override (optional)</label>
            <input
              type="number"
              value={tokenForm.rate_limit_override ?? ''}
              onChange={(e) => setTokenForm({ ...tokenForm, rate_limit_override: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires In (days)</label>
            <input
              type="number"
              value={tokenForm.expires_in_days}
              onChange={(e) => setTokenForm({ ...tokenForm, expires_in_days: parseInt(e.target.value) || 90 })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded disabled:opacity-50"
            >
              Generate Token
            </button>
          </div>
        </form>
        {generatedToken && (
          <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
            <p className="font-semibold">New Token (store it, it won't be shown again):</p>
            <code className="block bg-white p-2 mt-2 break-all text-sm">{generatedToken}</code>
          </div>
        )}
      </div>
    </div>
  );
};