import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCreatePost, useGenerateCaption, useGetBestTimes, useGetAssetUploadUrl } from '@workspace/api-client-react';
import { useBrand } from '@/contexts/BrandContext';
import { Button, Card, Input, Textarea, Badge } from '@/components/ui/shared';
import { ImagePlus, Wand2, Sparkles, Send, Calendar, Clock, Facebook, Instagram, MapPin, Upload, X, Film, Image } from 'lucide-react';
import { format } from 'date-fns';

const PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: Facebook, max: 63000 },
  { id: 'instagram', name: 'Instagram', icon: Instagram, max: 2200 },
  { id: 'google', name: 'Google Business', icon: MapPin, max: 1500 },
];

const CONTENT_TYPES = ['Before/After', 'Offer/Promo', 'Testimonial', 'Educational', 'Behind the Scenes', 'Seasonal', 'Other'];

export default function Compose() {
  const { activeBrand } = useBrand();
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram']);
  const [contentType, setContentType] = useState(CONTENT_TYPES[0]);
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  const [brief, setBrief] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFormat, setMediaFormat] = useState<'image' | 'video'>('image');
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: bestTimes } = useGetBestTimes({ brand: activeBrand });
  const createPost = useCreatePost();
  const generateAi = useGenerateCaption();
  const getUploadUrl = useGetAssetUploadUrl();

  const handleFileSelect = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return;

    setMediaFile(file);
    setMediaFormat(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
    setUploadedUrl(null);
    setIsUploading(true);

    try {
      getUploadUrl.mutate({
        data: {
          filename: file.name,
          contentType: file.type,
          brand: activeBrand,
          assetContentType: contentType,
          format: isVideo ? 'video' : 'image',
        }
      }, {
        onSuccess: async (res) => {
          await fetch(res.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          setUploadedUrl(res.publicUrl);
          setIsUploading(false);
        },
        onError: () => {
          setIsUploading(false);
        }
      });
    } catch {
      setIsUploading(false);
    }
  }, [activeBrand, contentType, getUploadUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setUploadedUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePlatformToggle = (id: string) => {
    setPlatforms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const currentMaxChars = platforms.length > 0 
    ? Math.min(...platforms.map(p => PLATFORMS.find(pl => pl.id === p)?.max || 63000))
    : 2200;
  
  const charCount = caption.length;
  const charPercent = charCount / currentMaxChars;
  const isCharWarning = charPercent > 0.8 && charPercent <= 0.95;
  const isCharError = charPercent > 0.95;

  const handleSubmit = () => {
    if (!caption || platforms.length === 0) return;
    
    // Combine date/time in NYC timezone roughly
    const dateStr = isScheduled && scheduleDate && scheduleTime 
      ? new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString()
      : new Date().toISOString();

    createPost.mutate({
      data: {
        brand: activeBrand,
        platforms,
        caption,
        content_type: contentType,
        headline_variant: headline || undefined,
        link_url: link || undefined,
        image_url: mediaFormat === 'image' ? (uploadedUrl ?? undefined) : undefined,
        video_url: mediaFormat === 'video' ? (uploadedUrl ?? undefined) : undefined,
        media_format: uploadedUrl ? mediaFormat : 'text',
        scheduled_at: dateStr,
        post_now: !isScheduled,
      }
    }, {
      onSuccess: () => {
        setCaption('');
        setHeadline('');
        setLink('');
        clearMedia();
        alert('Post successfully added to queue!');
      },
      onError: (err) => {
        alert('Error creating post: ' + err.error);
      }
    });
  };

  const handleAiGenerate = () => {
    if (!brief) return;
    generateAi.mutate({
      data: { brand: activeBrand, content_type: contentType, brief }
    }, {
      onSuccess: (res) => {
        setCaption(res.caption);
        setShowAi(false);
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col lg:flex-row gap-6">
      
      {/* Editor Column */}
      <div className="flex-1 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight mb-1">Compose</h1>
          <p className="text-muted text-sm">Create and schedule content across platforms.</p>
        </div>

        <Card className="p-6 flex flex-col gap-6">
          {/* Platforms */}
          <div className="flex flex-wrap gap-3">
            {PLATFORMS.map(p => {
              const active = platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => handlePlatformToggle(p.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-muted hover:bg-surface/80 hover:text-foreground'
                  }`}
                >
                  <p.icon className="w-4 h-4" />
                  {p.name}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted uppercase">Content Type</label>
              <select 
                value={contentType}
                onChange={e => setContentType(e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              >
                {CONTENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted uppercase">Headline Variant (Optional)</label>
              <Input 
                placeholder="e.g. Test A - Scarcity" 
                value={headline}
                onChange={e => setHeadline(e.target.value)}
              />
            </div>
          </div>

          {/* AI Generator Toggle */}
          <div className="bg-surface/50 border border-border/50 rounded-xl p-1 overflow-hidden">
            <button 
              onClick={() => setShowAi(!showAi)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Magic Compose</span>
              <Wand2 className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showAi && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3 pt-1 flex gap-2"
                >
                  <Input 
                    placeholder="Briefly describe what this post is about..." 
                    value={brief}
                    onChange={e => setBrief(e.target.value)}
                    className="bg-background"
                  />
                  <Button variant="primary" onClick={handleAiGenerate} disabled={!brief || generateAi.isPending}>
                    {generateAi.isPending ? '...' : 'Generate'}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2 relative">
            <Textarea 
              placeholder="What's the story today?" 
              className="min-h-[160px] text-base leading-relaxed"
              value={caption}
              onChange={e => setCaption(e.target.value)}
            />
            <div className={`absolute bottom-3 right-3 text-xs font-mono ${isCharError ? 'text-error' : isCharWarning ? 'text-warning' : 'text-muted/50'}`}>
              {charCount} / {currentMaxChars}
            </div>
          </div>

          {/* Media Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleInputChange}
          />

          {mediaPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border bg-surface/30">
              {mediaFormat === 'video' ? (
                <video
                  src={mediaPreview}
                  controls
                  className="w-full max-h-64 object-contain bg-black"
                />
              ) : (
                <img
                  src={mediaPreview}
                  alt="Media preview"
                  className="w-full max-h-64 object-contain bg-surface/50"
                />
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1 text-xs text-white">
                {mediaFormat === 'video' ? <Film className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                {mediaFormat}
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-2">
                {isUploading && (
                  <span className="bg-black/60 rounded-full px-2 py-1 text-xs text-primary animate-pulse">
                    Uploading…
                  </span>
                )}
                {uploadedUrl && !isUploading && (
                  <span className="bg-black/60 rounded-full px-2 py-1 text-xs text-success">
                    ✓ Uploaded
                  </span>
                )}
                <button
                  onClick={clearMedia}
                  className="bg-black/60 hover:bg-red-600/80 text-white rounded-full p-1 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-muted truncate max-w-[60%]">{mediaFile?.name}</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:underline"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-muted transition-colors ${
                isDragging ? 'border-primary bg-primary/5 text-primary' : 'border-border/50 bg-surface/30'
              }`}
            >
              <ImagePlus className={`w-8 h-8 mb-2 transition-colors ${isDragging ? 'text-primary' : ''}`} />
              <span className="text-sm font-medium mb-1">Drag & drop here</span>
              <span className="text-xs opacity-60 mb-4">Photos and videos supported</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors active:scale-95"
              >
                <Upload className="w-4 h-4" />
                Browse Files
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-mono text-muted uppercase">Link URL</label>
            <Input 
              placeholder="https://..." 
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>
        </Card>
      </div>

      {/* Sidebar Settings / Preview */}
      <div className="lg:w-80 flex flex-col gap-6">
        <Card className="p-5 flex flex-col gap-5">
          <h3 className="font-mono text-sm uppercase tracking-wider text-muted flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Schedule
          </h3>
          
          <div className="flex bg-surface p-1 rounded-full border border-border">
            <button 
              className={`flex-1 text-sm py-1.5 rounded-full font-medium transition-all ${!isScheduled ? 'bg-background shadow text-foreground' : 'text-muted'}`}
              onClick={() => setIsScheduled(false)}
            >
              Post Now
            </button>
            <button 
              className={`flex-1 text-sm py-1.5 rounded-full font-medium transition-all ${isScheduled ? 'bg-background shadow text-foreground' : 'text-muted'}`}
              onClick={() => setIsScheduled(true)}
            >
              Schedule
            </button>
          </div>

          <AnimatePresence>
            {isScheduled && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="text-xs" />
                  <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="text-xs" />
                </div>
                
                {bestTimes && bestTimes.hasEnoughData && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <p className="text-[10px] uppercase font-mono text-primary mb-2 flex items-center gap-1"><Clock className="w-3 h-3"/> Suggested Times</p>
                    <div className="flex flex-wrap gap-2">
                      {bestTimes.times.slice(0, 3).map((t, i) => (
                        <Badge key={i} variant="primary" className="cursor-pointer hover:bg-primary/20">
                          {t.day} {t.hour}:00
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <Button 
            className="w-full mt-2" 
            size="lg" 
            disabled={platforms.length === 0 || !caption || createPost.isPending}
            onClick={handleSubmit}
          >
            {createPost.isPending ? 'Processing...' : isScheduled ? 'Schedule Post' : 'Post Now'}
            <Send className="w-4 h-4 ml-2" />
          </Button>
        </Card>

        {/* Live Preview */}
        <div className="flex-1 min-h-[300px] border border-border/50 bg-surface/30 rounded-xl p-4 flex flex-col">
          <div className="text-xs font-mono text-muted uppercase tracking-wider mb-4">Live Preview</div>
          <div className="flex-1 bg-background border border-border rounded-lg p-4 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center text-xs">
                {activeBrand === 'wolfpackwash' ? '🐺' : activeBrand === 'mopmafia' ? '🧹' : '🌊'}
              </div>
              <div>
                <div className="text-sm font-medium leading-none mb-1 capitalize">{activeBrand}</div>
                <div className="text-[10px] text-muted">Sponsored • <MapPin className="inline w-3 h-3"/></div>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap flex-1 overflow-hidden opacity-90 break-words line-clamp-6">
              {caption || "Your caption will appear here..."}
            </div>
            {link && <div className="mt-3 text-xs text-primary truncate">{link}</div>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
