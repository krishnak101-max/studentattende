import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';

interface Batch {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

interface BatchContextType {
  batches: Batch[];
  loadingBatches: boolean;
  refreshBatches: () => Promise<void>;
  activeBatches: Batch[];
}

const BatchContext = createContext<BatchContextType | undefined>(undefined);

export const BatchProvider = ({ children }: { children: ReactNode }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('batches').select('*').order('created_at', { ascending: true });
    
    // Fallback if table doesn't exist yet or query fails
    if (error || !data || data.length === 0) {
       // fallback static batches
       setBatches([
         { id: '1', name: 'S1', is_active: true },
         { id: '2', name: 'S2', is_active: true },
         { id: '3', name: 'S3', is_active: true },
         { id: '4', name: 'N1', is_active: true },
         { id: '5', name: 'N2', is_active: true },
         { id: '6', name: 'E1', is_active: true }
       ]);
    } else {
       setBatches(data as Batch[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const activeBatches = batches.filter(b => b.is_active);

  return (
    <BatchContext.Provider value={{ batches, loadingBatches, refreshBatches: fetchBatches, activeBatches }}>
      {children}
    </BatchContext.Provider>
  );
};

export const useBatches = () => {
  const context = useContext(BatchContext);
  if (context === undefined) {
    throw new Error('useBatches must be used within a BatchProvider');
  }
  return context;
};
