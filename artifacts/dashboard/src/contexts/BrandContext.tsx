import React, { createContext, useContext, useState, useEffect } from 'react';

export type BrandId = 'wolfpackwash' | 'mopmafia' | 'blueocean';

interface BrandContextType {
  activeBrand: BrandId;
  setActiveBrand: (brand: BrandId) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [activeBrand, setActiveBrand] = useState<BrandId>(() => {
    const saved = localStorage.getItem('command-active-brand');
    return (saved as BrandId) || 'wolfpackwash';
  });

  useEffect(() => {
    localStorage.setItem('command-active-brand', activeBrand);
  }, [activeBrand]);

  return (
    <BrandContext.Provider value={{ activeBrand, setActiveBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
