import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { PenSquare, CalendarDays, History, BarChart3, Image as ImageIcon, Megaphone } from 'lucide-react';
import { useBrand } from '@/contexts/BrandContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { name: 'Compose', path: '/', icon: PenSquare },
  { name: 'Queue', path: '/queue', icon: CalendarDays },
  { name: 'History', path: '/history', icon: History },
  { name: 'Performance', path: '/performance', icon: BarChart3 },
  { name: 'Ads', path: '/ads', icon: Megaphone },
  { name: 'Library', path: '/library', icon: ImageIcon },
];

const BRANDS = [
  { id: 'wolfpackwash', name: 'Wolf Pack Wash', emoji: '🐺' },
  { id: 'mopmafia', name: 'Mop Mafia', emoji: '🧹' },
  { id: 'blueocean', name: 'Blue Ocean', emoji: '🌊' },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { activeBrand, setActiveBrand } = useBrand();
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTime(new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-surface/30">
        <div className="p-6">
          <div className="flex items-center gap-1 mb-8">
            <span className="font-mono text-lg font-bold tracking-widest uppercase">Command</span>
            <span className="text-primary text-xl leading-none">.</span>
          </div>

          <div className="space-y-1 mb-8">
            <div className="text-xs font-mono text-muted mb-3 uppercase tracking-wider">Brand</div>
            {BRANDS.map(b => (
              <button
                key={b.id}
                onClick={() => setActiveBrand(b.id as any)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                  activeBrand === b.id 
                    ? "bg-primary/10 text-primary font-medium" 
                    : "text-muted hover:bg-surface hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>{b.emoji}</span>
                  <span>{b.name}</span>
                </div>
                {activeBrand === b.id && (
                  <motion.div layoutId="active-brand-indicator" className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-xs font-mono text-muted mb-3 uppercase tracking-wider">Menu</div>
            {NAV_ITEMS.map(item => {
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative group",
                  isActive ? "text-foreground font-medium bg-surface" : "text-muted hover:text-foreground hover:bg-surface/50"
                )}>
                  {isActive && <motion.div layoutId="active-nav-indicator" className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r-full" />}
                  <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "group-hover:text-foreground")} />
                  {item.name}
                </Link>
              );
            })}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted/40 cursor-not-allowed">
              <BarChart3 className="w-4 h-4 opacity-40" />
              Advanced Analytics <span className="text-[10px] ml-auto border border-border/50 px-1.5 rounded">Soon</span>
            </div>
          </div>
        </div>

        <div className="mt-auto p-6 text-xs font-mono text-muted flex flex-col gap-1 border-t border-border/50 bg-surface/20">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            System Online
          </div>
          <div>NYC: {time}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 glass-panel z-50 flex items-center justify-around px-4 pb-safe">
        {NAV_ITEMS.map(item => {
          const isActive = location === item.path;
          return (
            <Link key={item.path} href={item.path} className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1",
              isActive ? "text-primary" : "text-muted hover:text-foreground"
            )}>
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
