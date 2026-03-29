import React from 'react';
import { motion } from 'framer-motion';
import { useListPosts, useDeletePost } from '@workspace/api-client-react';
import { useBrand } from '@/contexts/BrandContext';
import { Card, Badge, Button } from '@/components/ui/shared';
import { formatNYTime } from '@/lib/utils';
import { Clock, Trash2, CalendarX2 } from 'lucide-react';

export default function Queue() {
  const { activeBrand } = useBrand();
  const { data, isLoading, refetch } = useListPosts({ brand: activeBrand, status: 'scheduled' });
  const deletePost = useDeletePost();

  const handleCancel = (id: string) => {
    if (confirm("Are you sure you want to cancel this scheduled post?")) {
      deletePost.mutate({ id }, {
        onSuccess: () => refetch()
      });
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-1">Queue</h1>
        <p className="text-muted text-sm">Upcoming scheduled content across platforms.</p>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          <div className="w-full h-32 bg-surface animate-pulse rounded-xl" />
          <div className="w-full h-32 bg-surface animate-pulse rounded-xl" />
        </div>
      ) : data?.posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/50 rounded-xl text-muted">
          <CalendarX2 className="w-12 h-12 mb-3 opacity-20" />
          <p>No posts scheduled for this brand.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.posts.map(post => (
            <Card key={post.id} className="flex flex-col group">
              <div className="p-4 border-b border-border/50 bg-surface/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="uppercase font-mono tracking-wider"><Clock className="w-3 h-3 mr-1"/> Scheduled</Badge>
                </div>
                <div className="text-xs font-mono text-muted">{formatNYTime(post.scheduled_at)}</div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.platforms.map(p => <Badge key={p} variant="default" className="capitalize">{p}</Badge>)}
                  <Badge variant="primary" className="ml-auto">{post.content_type}</Badge>
                </div>
                {post.headline_variant && <div className="text-sm font-medium mb-1">{post.headline_variant}</div>}
                <div className="text-sm text-muted line-clamp-3 mb-4">{post.caption}</div>
                
                <div className="mt-auto pt-4 flex justify-end">
                  <Button variant="danger" size="sm" onClick={() => handleCancel(post.id)} disabled={deletePost.isPending}>
                    <Trash2 className="w-4 h-4 mr-1" /> Cancel Post
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
