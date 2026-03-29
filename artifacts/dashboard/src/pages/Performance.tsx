import React from 'react';
import { motion } from 'framer-motion';
import { useGetMetricsSummary, useGetInsights, useGetHeatmap } from '@workspace/api-client-react';
import { useBrand } from '@/contexts/BrandContext';
import { Card, Badge } from '@/components/ui/shared';
import { TrendingUp, Award, Target, Activity, Lightbulb } from 'lucide-react';

export default function Performance() {
  const { activeBrand } = useBrand();
  
  const { data: summary, isLoading: loadingSummary } = useGetMetricsSummary({ brand: activeBrand });
  const { data: insights, isLoading: loadingInsights } = useGetInsights({ brand: activeBrand });
  const { data: heatmap, isLoading: loadingHeatmap } = useGetHeatmap({ brand: activeBrand });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-1">Performance</h1>
        <p className="text-muted text-sm">Analytics and AI-driven insights for your content.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted text-sm mb-2"><Target className="w-4 h-4 text-primary" /> Total Posts</div>
          <div className="text-3xl font-mono">{loadingSummary ? '--' : summary?.totalPosts || 0}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted text-sm mb-2"><TrendingUp className="w-4 h-4 text-success" /> Avg Engagement</div>
          <div className="text-3xl font-mono">{loadingSummary ? '--' : `${((summary?.avgEngagementRate || 0)*100).toFixed(1)}%`}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted text-sm mb-2"><Award className="w-4 h-4 text-warning" /> Best Platform</div>
          <div className="text-xl font-medium mt-1 capitalize">{loadingSummary ? '--' : summary?.bestPlatform || 'N/A'}</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted text-sm mb-2"><Activity className="w-4 h-4 text-primary" /> Top Content Type</div>
          <div className="text-xl font-medium mt-1">{loadingSummary ? '--' : summary?.bestContentType || 'N/A'}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap */}
        <Card className="p-6 lg:col-span-2 flex flex-col">
          <h3 className="font-mono text-sm uppercase tracking-wider text-muted mb-6 flex items-center gap-2">
            Engagement Heatmap
          </h3>
          {loadingHeatmap ? (
            <div className="w-full h-64 bg-surface animate-pulse rounded-xl" />
          ) : heatmap?.hasEnoughData ? (
            <div className="flex-1 flex flex-col">
              {/* Very simple custom heatmap grid rendering for beautiful aesthetics */}
              <div className="flex text-[10px] text-muted mb-2 font-mono ml-8">
                {[0,6,12,18].map(h => <div key={h} className="flex-1">{h}:00</div>)}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => (
                  <div key={day} className="flex flex-1 items-center gap-2">
                    <div className="text-[10px] w-6 font-mono text-muted">{day}</div>
                    <div className="flex-1 flex gap-0.5 h-full">
                      {Array.from({ length: 24 }).map((_, hIdx) => {
                        const cell = heatmap.data.find(c => c.day === dIdx && c.hour === hIdx);
                        const intensity = cell ? Math.min(cell.avgEngagement * 5, 1) : 0;
                        return (
                          <div 
                            key={hIdx} 
                            className="flex-1 rounded-[2px] transition-all"
                            style={{ 
                              backgroundColor: `hsla(194, 100%, 50%, ${intensity === 0 ? 0.05 : intensity})`,
                              border: intensity === 0 ? '1px solid hsla(0,0%,20%,0.2)' : 'none'
                            }}
                            title={`Engagement: ${cell?.avgEngagement || 0}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted text-sm border border-dashed border-border/50 rounded-xl">
              Not enough data yet. Keep posting!
            </div>
          )}
        </Card>

        {/* AI Insights */}
        <Card className="p-6 flex flex-col bg-primary/5 border-primary/20">
          <h3 className="font-mono text-sm uppercase tracking-wider text-primary mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Auto Insights
          </h3>
          {loadingInsights ? (
            <div className="space-y-3">
              <div className="h-10 bg-surface animate-pulse rounded" />
              <div className="h-10 bg-surface animate-pulse rounded" />
              <div className="h-10 bg-surface animate-pulse rounded" />
            </div>
          ) : (
            <div className="space-y-4">
              {insights?.insights.map((insight, i) => (
                <div key={i} className="text-sm bg-surface/80 p-3 rounded-lg border border-border/50 shadow-sm">
                  {insight}
                </div>
              ))}
              {!insights?.insights?.length && <div className="text-muted text-sm">Check back later for insights.</div>}
            </div>
          )}
        </Card>
      </div>

      {/* Rankings Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border bg-surface/30">
          <h3 className="font-mono text-sm uppercase tracking-wider text-muted">Top Ranked Posts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface/50 text-muted text-xs font-mono uppercase">
              <tr>
                <th className="px-5 py-3">Content</th>
                <th className="px-5 py-3">Platform</th>
                <th className="px-5 py-3 text-right">Reach</th>
                <th className="px-5 py-3 text-right">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {summary?.rankedPosts.map((rp, i) => (
                <tr key={rp.id} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium mb-1">{rp.headline_variant || 'No Headline'}</div>
                    <Badge variant="default" className="text-[10px]">{rp.content_type}</Badge>
                  </td>
                  <td className="px-5 py-4 capitalize">{rp.platform}</td>
                  <td className="px-5 py-4 text-right font-mono">{rp.reach}</td>
                  <td className="px-5 py-4 text-right font-mono text-primary">{((rp.engagement_rate)*100).toFixed(1)}%</td>
                </tr>
              ))}
              {!summary?.rankedPosts?.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted">No posts available for ranking yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
