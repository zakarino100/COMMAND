import React from 'react';
import { motion } from 'framer-motion';
import { useListPosts } from '@workspace/api-client-react';
import { useBrand } from '@/contexts/BrandContext';
import { Card, Badge } from '@/components/ui/shared';
import { formatNYTime } from '@/lib/utils';
import { ThumbsUp, MessageCircle, Eye, AlertCircle, FileX2 } from 'lucide-react';

export default function History() {
  const { activeBrand } = useBrand();
  // We want both posted and failed. Orval hook accepts string, the API presumably splits it.
  const { data, isLoading } = useListPosts({ brand: activeBrand, status: 'posted,failed' });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-1">History</h1>
        <p className="text-muted text-sm">Review past posts and their status.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="w-full h-24 bg-surface animate-pulse rounded-xl" />
          <div className="w-full h-24 bg-surface animate-pulse rounded-xl" />
        </div>
      ) : data?.posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/50 rounded-xl text-muted">
          <FileX2 className="w-12 h-12 mb-3 opacity-20" />
          <p>No post history available.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {data?.posts.map(post => {
            const isFailed = post.status === 'failed';
            return (
              <Card key={post.id} className={`flex flex-col md:flex-row gap-4 p-4 ${isFailed ? 'border-error/30 bg-error/5' : ''}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={isFailed ? 'error' : 'success'} className="uppercase font-mono">
                      {post.status}
                    </Badge>
                    <span className="text-xs text-muted font-mono">{formatNYTime(post.posted_at || post.scheduled_at)}</span>
                    <div className="flex gap-1 ml-auto">
                      {post.platforms.map(p => <Badge key={p} variant="default" className="text-[10px] capitalize">{p}</Badge>)}
                    </div>
                  </div>
                  {post.headline_variant && <div className="text-sm font-medium mb-1">{post.headline_variant}</div>}
                  <div className="text-sm text-foreground/80 line-clamp-2">{post.caption}</div>
                  {isFailed && post.error_message && (
                    <div className="mt-2 text-xs text-error flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {post.error_message}
                    </div>
                  )}
                </div>
                
                {/* Mock inline stats for MVP since metrics endpoint is per post id, but we want inline. We'll show placeholders or actual if included in future API extensions */}
                {!isFailed && (
                  <div className="md:w-48 bg-surface/50 rounded-lg p-3 flex flex-col justify-center gap-2 border border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3"/> Likes</span>
                      <span className="font-mono text-foreground">--</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3"/> Comments</span>
                      <span className="font-mono text-foreground">--</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3"/> Reach</span>
                      <span className="font-mono text-foreground">--</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
