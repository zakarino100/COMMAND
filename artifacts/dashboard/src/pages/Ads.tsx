import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Badge, Button, Input } from '@/components/ui/shared';
import { BarChart3, DollarSign, Target, MousePointerClick, TrendingUp, Activity, Plus, RefreshCw, AlertTriangle } from 'lucide-react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export default function Ads() {
  const queryClient = useQueryClient();
  const [brandFilter, setBrandFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    brand: 'wolfpackwash',
    platform: 'meta',
    account_id: '',
    display_name: '',
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (brandFilter !== 'all') params.set('brand', brandFilter);
    if (platformFilter !== 'all') params.set('platform', platformFilter);
    return params.toString() ? `?${params.toString()}` : '';
  }, [brandFilter, platformFilter]);

  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['ads-accounts'],
    queryFn: () => fetchJson<{ accounts: any[] }>('/api/ads/accounts'),
  });
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['ads-summary', query],
    queryFn: () => fetchJson<any>(`/api/ads/summary${query}`),
  });
  const { data: campaignsData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['ads-campaigns', query],
    queryFn: () => fetchJson<{ campaigns: any[] }>(`/api/ads/campaigns${query}`),
  });
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['ads-insights', query],
    queryFn: () => fetchJson<{ insights: string[] }>(`/api/ads/insights${query}`),
  });

  const accounts = accountsData?.accounts ?? [];
  const campaigns = campaignsData?.campaigns ?? [];
  const brands = Array.from(new Set(accounts.map((a) => a.brand))).sort();

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ads-accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['ads-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['ads-campaigns'] }),
      queryClient.invalidateQueries({ queryKey: ['ads-insights'] }),
    ]);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await fetchJson('/api/ads/accounts/upsert', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm((f) => ({ ...f, account_id: '', display_name: '' }));
      await refreshAll();
    } finally {
      setAdding(false);
    }
  };

  const syncMeta = async () => {
    setSyncing(true);
    try {
      await fetchJson('/api/ads/sync/meta', {
        method: 'POST',
        body: JSON.stringify(brandFilter !== 'all' ? { brand: brandFilter } : {}),
      });
      await refreshAll();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight mb-1">Ads</h1>
          <p className="text-muted text-sm">Cross-platform ad intelligence for Meta and Google without touching your existing social workflows.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => refreshAll()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button onClick={syncMeta} disabled={syncing}>
            <BarChart3 className="w-4 h-4 mr-2" /> {syncing ? 'Syncing Meta...' : 'Sync Meta'}
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2">Brand</label>
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="all">All Brands</option>
              {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-muted mb-2">Platform</label>
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="all">All Platforms</option>
              <option value="meta">Meta</option>
              <option value="google">Google</option>
            </select>
          </div>
          <div className="md:col-span-2 text-sm text-muted flex items-end">
            Meta sync is live in v1. Google account storage is ready, and Google sync is scaffolded next.
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard icon={DollarSign} label="Spend" value={loadingSummary ? '--' : `$${(summary?.spend ?? 0).toFixed(2)}`} />
        <StatCard icon={Target} label="Leads" value={loadingSummary ? '--' : String(summary?.leads ?? 0)} />
        <StatCard icon={TrendingUp} label="CPL" value={loadingSummary ? '--' : `$${(summary?.cpl ?? 0).toFixed(2)}`} />
        <StatCard icon={MousePointerClick} label="CTR" value={loadingSummary ? '--' : `${((summary?.ctr ?? 0) * 100).toFixed(2)}%`} />
        <StatCard icon={Activity} label="CPC" value={loadingSummary ? '--' : `$${(summary?.cpc ?? 0).toFixed(2)}`} />
        <StatCard icon={BarChart3} label="ROAS" value={loadingSummary ? '--' : `${(summary?.roas ?? 0).toFixed(2)}x`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted">Connected Ad Accounts</h3>
            <Badge variant="primary">{accounts.length}</Badge>
          </div>

          <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="wolfpackwash">wolfpackwash</option>
              <option value="mopmafia">mopmafia</option>
              <option value="blueocean">blueocean</option>
              <option value="showroomautostyles">showroomautostyles</option>
            </select>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm">
              <option value="meta">meta</option>
              <option value="google">google</option>
            </select>
            <Input placeholder="Account / Customer ID" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} />
            <div className="flex gap-2">
              <Input placeholder="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
              <Button type="submit" disabled={adding} className="shrink-0"><Plus className="w-4 h-4" /></Button>
            </div>
          </form>

          <div className="space-y-2">
            {loadingAccounts ? (
              <div className="text-sm text-muted">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-sm text-muted border border-dashed border-border/50 rounded-xl p-4">No ad accounts connected yet. Add WPW Meta first and hit Sync Meta.</div>
            ) : accounts.map((account) => (
              <div key={account.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-border/50 rounded-xl p-4 bg-surface/20">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{account.display_name}</div>
                    <Badge variant={account.platform === 'meta' ? 'primary' : 'default'}>{account.platform}</Badge>
                    <Badge variant="default">{account.brand}</Badge>
                  </div>
                  <div className="text-sm text-muted mt-1">{account.account_id}</div>
                </div>
                <div className="text-xs text-muted">{account.platform === 'google' ? 'Google sync next' : 'Ready for sync'}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 bg-primary/5 border-primary/20">
          <h3 className="font-mono text-sm uppercase tracking-wider text-primary mb-4">Auto Insights</h3>
          {loadingInsights ? (
            <div className="space-y-3">
              <div className="h-12 bg-surface rounded animate-pulse" />
              <div className="h-12 bg-surface rounded animate-pulse" />
              <div className="h-12 bg-surface rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-3">
              {insights?.insights?.map((insight, i) => (
                <div key={i} className="text-sm bg-surface/80 p-3 rounded-lg border border-border/50 shadow-sm">{insight}</div>
              ))}
              {!insights?.insights?.length && <div className="text-sm text-muted">No insights yet.</div>}
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-border/50">
            <div className="flex items-start gap-2 text-xs text-muted">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-warning" />
              Meta requires a valid token in COMMAND secrets: <code className="text-foreground">META_MARKETING_API_TOKEN</code>. Google sync will need Ads API creds next.
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border bg-surface/30 flex items-center justify-between">
          <h3 className="font-mono text-sm uppercase tracking-wider text-muted">Campaign Performance</h3>
          <Badge variant="default">{campaigns.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface/50 text-muted text-xs font-mono uppercase">
              <tr>
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3 text-right">Spend</th>
                <th className="px-5 py-3 text-right">Leads</th>
                <th className="px-5 py-3 text-right">CPL</th>
                <th className="px-5 py-3 text-right">CTR</th>
                <th className="px-5 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {loadingCampaigns ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-muted">Loading campaigns...</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-muted">No campaigns synced yet. Add an account and hit Sync Meta.</td></tr>
              ) : campaigns.map((campaign) => (
                <tr key={`${campaign.platform}-${campaign.account_id}-${campaign.campaign_id}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium mb-1">{campaign.campaign_name}</div>
                    <div className="text-xs text-muted">{campaign.status || 'unknown'} {campaign.objective ? `• ${campaign.objective}` : ''}</div>
                  </td>
                  <td className="px-5 py-4">{campaign.brand}</td>
                  <td className="px-5 py-4 capitalize">{campaign.platform}</td>
                  <td className="px-5 py-4 text-right font-mono">${(campaign.spend ?? 0).toFixed(2)}</td>
                  <td className="px-5 py-4 text-right font-mono">{campaign.leads ?? 0}</td>
                  <td className="px-5 py-4 text-right font-mono">${(campaign.cpl ?? 0).toFixed(2)}</td>
                  <td className="px-5 py-4 text-right font-mono">{((campaign.ctr ?? 0) * 100).toFixed(2)}%</td>
                  <td className="px-5 py-4 text-right font-mono text-primary">{(campaign.roas ?? 0).toFixed(2)}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted text-sm mb-2"><Icon className="w-4 h-4 text-primary" /> {label}</div>
      <div className="text-2xl lg:text-3xl font-mono">{value}</div>
    </Card>
  );
}
