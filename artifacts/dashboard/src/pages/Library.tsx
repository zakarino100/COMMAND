import React from 'react';
import { motion } from 'framer-motion';
import { useListAssets } from '@workspace/api-client-react';
import { useBrand } from '@/contexts/BrandContext';
import { Card, Badge } from '@/components/ui/shared';
import { ImageIcon, HardDrive } from 'lucide-react';

export default function Library() {
  const { activeBrand } = useBrand();
  const { data, isLoading } = useListAssets({ brand: activeBrand });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold font-mono tracking-tight mb-1">Asset Library</h1>
        <p className="text-muted text-sm">Media assets, automatically tagged by content type and performance.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="aspect-square bg-surface animate-pulse rounded-xl" />)}
        </div>
      ) : data?.assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-border/50 rounded-xl text-muted">
          <HardDrive className="w-12 h-12 mb-3 opacity-20" />
          <p>No assets found in the library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {data?.assets.map(asset => (
            <Card key={asset.id} className="group relative aspect-square overflow-hidden cursor-pointer hover:border-primary transition-colors">
              <img src={asset.url} alt="Asset" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
                <Badge variant="primary" className="text-[10px]">{asset.content_type}</Badge>
                <div className="text-[10px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-white backdrop-blur-md">
                  {asset.times_used}x used
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
