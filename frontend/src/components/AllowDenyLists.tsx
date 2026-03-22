import React, { useState, useCallback } from 'react';
import { useLists } from '@/hooks/useLists';
import { ListItem } from '@/types';

export const AllowDenyLists: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'allowlist' | 'denylist'>('allowlist');
  const { items, loading, error, addItem, removeItem } = useLists(activeTab);
  const [newItem, setNewItem] = useState<{ ip: string; reason?: string; expires_at?: string }>({ ip: '', reason: '' });
  const [bulkInput, setBulkInput] = useState('');
  const [bulkFormat, setBulkFormat] = useState<'csv' | 'json'>('csv');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addItem(newItem);
      setNewItem({ ip: '', reason: '' });
    } catch (err) {
      alert(err);
    }
  };

  const handleRemove = async (cidr: string) => {
    if (!confirm(`Remove ${cidr}?`)) return;
    try {
      await removeItem(cidr);
    } catch (err) {
      alert(err);
    }
  };

  const exportList = useCallback(() => {
    let content: string;
    if (bulkFormat === 'csv') {
      const headers = ['ip', 'reason', 'expires_at'];
      const rows = items.map(item => [item.ip, item.reason || '', item.expires_at || '']);
      content = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
    } else {
      content = JSON.stringify(items, null, 2);
    }
    const blob = new Blob([content], { type: bulkFormat === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}.${bulkFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, activeTab, bulkFormat]);

  const handleBulkImport = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (!text.trim()) return;
    try {
      let itemsToAdd: { ip: string; reason?: string; expires_at?: string }[];
      if (bulkFormat === 'csv') {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV must have header');
        // Skip header; parse each row (naive)
        itemsToAdd = lines.slice(1).map(line => {
          const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // simple split with quotes
          const ip = cells[0].replace(/^"|"$/g, '').trim();
          const reason = cells[1]?.replace(/^"|"$/g, '').trim() || undefined;
          const expires = cells[2]?.replace(/^"|"$/g, '').trim() || undefined;
          return { ip, reason, expires_at: expires };
        });
      } else {
        itemsToAdd = JSON.parse(text);
      }
      // Add each item sequentially
      for (const item of itemsToAdd) {
        await addItem(item);
      }
      setBulkInput('');
      alert(`Imported ${itemsToAdd.length} items.`);
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : err));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Allow/Deny Lists</h2>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`pb-2 px-4 font-medium ${activeTab === 'allowlist' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('allowlist')}
        >
          Allowlist
        </button>
        <button
          className={`pb-2 px-4 font-medium ${activeTab === 'denylist' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('denylist')}
        >
          Denylist
        </button>
      </div>

      {error && <div className="text-red-600 bg-red-100 p-3 rounded">{error}</div>}

      {/* Add Single Entry */}
      <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">CIDR (IP/Network)</label>
          <input
            required
            type="text"
            value={newItem.ip}
            onChange={(e) => setNewItem({ ...newItem, ip: e.target.value })}
            placeholder="192.168.1.0/24"
            className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Reason (optional)</label>
          <input
            type="text"
            value={newItem.reason}
            onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })}
            placeholder="Internal network"
            className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Expires (ISO datetime, optional)</label>
          <input
            type="datetime-local"
            value={newItem.expires_at?.slice(0, 16) || ''}
            onChange={(e) => setNewItem({ ...newItem, expires_at: e.target.value ? e.target.value + ':00Z' : undefined })}
            className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded disabled:opacity-50 self-end"
        >
          Add to {activeTab === 'allowlist' ? 'Allowlist' : 'Denylist'}
        </button>
      </form>

      {/* Bulk Import/Export */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold">Bulk Operations</h3>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={bulkFormat}
            onChange={(e) => setBulkFormat(e.target.value as 'csv' | 'json')}
            className="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <button onClick={exportList} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded">
            Export Current List
          </button>
          <span className="text-gray-500">or</span>
          <div className="flex-1">
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Paste list here (CSV or JSON) and press Import"
              className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600 min-h-[80px]"
            />
          </div>
          <button
            onClick={(e) => { handleBulkImport(e as any); }}
            disabled={!bulkInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-left py-3 px-4">CIDR</th>
              <th className="text-left py-3 px-4">Reason</th>
              <th className="text-left py-3 px-4">Expires At</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-3 px-4 font-mono">{item.ip}</td>
                <td className="py-3 px-4">{item.reason || '-'}</td>
                <td className="py-3 px-4 text-sm">{item.expires_at ? new Date(item.expires_at).toLocaleString() : '-'}</td>
                <td className="py-3 px-4">
                  <button onClick={() => handleRemove(item.ip)} className="text-red-600 hover:underline text-sm">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">No entries in {activeTab}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};