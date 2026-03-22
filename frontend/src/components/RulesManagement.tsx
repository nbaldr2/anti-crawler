import React, { useState } from 'react';
import { useRules } from '@/hooks/useRules';
import { RuleCreate, RuleResponse } from '@/types';
import { api } from '@/services/api';

export const RulesManagement: React.FC = () => {
  const { rules, loading, error, createRule, updateRule, deleteRule } = useRules();
  const [editingRule, setEditingRule] = useState<RuleResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RuleCreate>({
    name: '',
    description: '',
    condition_type: 'ip_in_list',
    condition: {},
    weight: 10,
    action: 'allow',
    enabled: true,
  });
  const [testRequest, setTestRequest] = useState({
    ip: '192.0.2.1',
    user_agent: 'Mozilla/5.0 (compatible; TestBot/1.0)',
    path: '/test',
    method: 'GET',
    headers: {},
  });
  const [testResult, setTestResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingRule) {
        await updateRule(editingRule.id, formData);
      } else {
        await createRule(formData);
      }
      resetForm();
    } catch (err) {
      alert(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: RuleResponse) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      condition_type: rule.condition_type,
      condition: rule.condition,
      weight: rule.weight,
      action: rule.action,
      threshold_override: rule.threshold_override,
      enabled: rule.enabled,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await deleteRule(id);
    } catch (err) {
      alert(err);
    }
  };

  const resetForm = () => {
    setEditingRule(null);
    setShowForm(false);
    setFormData({
      name: '',
      description: '',
      condition_type: 'ip_in_list',
      condition: {},
      weight: 10,
      action: 'allow',
      enabled: true,
    });
  };

  const handleTest = async () => {
    try {
      const result = await api.evaluate({
        ...testRequest,
        tls_ja3: undefined,
        body_hash: undefined,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ error: (err as Error).message });
    }
  };

  const conditionTypes = [
    'ip_in_list',
    'user_agent_matches',
    'path_matches',
    'rate_limit_exceeded',
    'risk_score_above',
    'custom_lua',
  ];

  const actions = ['allow', 'block', 'challenge', 'rate-limit'];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Rules Management</h2>

      {error && <div className="text-red-600 bg-red-100 p-3 rounded">{error}</div>}

      {/* Rule List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3 px-4">Condition Type</th>
              <th className="text-left py-3 px-4">Action</th>
              <th className="text-right py-3 px-4">Weight</th>
              <th className="text-center py-3 px-4">Enabled</th>
              <th className="text-left py-3 px-4">Description</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-3 px-4 font-medium">{rule.name}</td>
                <td className="py-3 px-4 text-sm">{rule.condition_type}</td>
                <td className="py-3 px-4">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    rule.action === 'allow' ? 'bg-green-100 text-green-800' :
                    rule.action === 'block' ? 'bg-red-100 text-red-800' :
                    rule.action === 'challenge' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {rule.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">{rule.weight}</td>
                <td className="py-3 px-4 text-center">
                  {rule.enabled ? '✅' : '❌'}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">{rule.description || '-'}</td>
                <td className="py-3 px-4 space-x-2">
                  <button onClick={() => handleEdit(rule)} className="text-primary-600 hover:underline text-sm">Edit</button>
                  <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">No rules defined.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded"
      >
        Create New Rule
      </button>

      {/* Rule Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">{editingRule ? 'Edit Rule' : 'Create Rule'}</h3>
                <button onClick={resetForm} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Action *</label>
                    <select
                      value={formData.action}
                      onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                    >
                      {actions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Condition Type *</label>
                    <select
                      value={formData.condition_type}
                      onChange={(e) => setFormData({ ...formData, condition_type: e.target.value })}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                    >
                      {conditionTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Weight (0-100) *</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Condition (JSON) *</label>
                    <textarea
                      required
                      value={JSON.stringify(formData.condition, null, 2)}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setFormData({ ...formData, condition: parsed });
                        } catch (err) {
                          // ignore invalid JSON while typing
                        }
                      }}
                      className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                      rows={4}
                      placeholder='{"ip": "192.168.1.0/24"}'
                    />
                    {formData.condition && (
                      <p className="text-xs text-gray-500 mt-1">
                        Condition structure depends on condition_type.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <label htmlFor="enabled" className="ml-2 text-sm">Enabled</label>
                  </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:border-gray-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading} className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded disabled:opacity-50">
                    {loading ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Live Test Panel */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-xl font-semibold mb-4">Live Rule Test</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">IP</label>
            <input
              type="text"
              value={testRequest.ip}
              onChange={(e) => setTestRequest({ ...testRequest, ip: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">User-Agent</label>
            <input
              type="text"
              value={testRequest.user_agent}
              onChange={(e) => setTestRequest({ ...testRequest, user_agent: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Path</label>
            <input
              type="text"
              value={testRequest.path}
              onChange={(e) => setTestRequest({ ...testRequest, path: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <select
              value={testRequest.method}
              onChange={(e) => setTestRequest({ ...testRequest, method: e.target.value })}
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleTest}
          className="mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded"
        >
          Test Rule
        </button>
        {testResult && (
          <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
            <h4 className="font-semibold mb-2">Result</h4>
            <pre className="text-sm overflow-auto">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};