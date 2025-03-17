import React, { createContext, useContext } from 'react';
import type { HealthProvider } from '@/src/providers/health/types/provider';
import { MeasurementSystem } from '@/src/utils/unitConversion';

interface DataContextProps {
  provider: HealthProvider;
  userId: string;
  date: string;
  measurementSystem: MeasurementSystem;
}

const DataContext = createContext<DataContextProps | undefined>(undefined);

interface DataProviderProps {
  provider: HealthProvider;
  userId: string;
  date?: string;
  measurementSystem?: MeasurementSystem;
  children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({
  provider,
  userId,
  date = new Date().toISOString().split('T')[0],
  measurementSystem = 'metric',
  children,
}) => {
  return (
    <DataContext.Provider value={{ provider, userId, date, measurementSystem }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataProvider = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataProvider must be used within a DataProvider');
  }
  return context;
};
