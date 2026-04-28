import { createContext, useContext } from 'react';
import { useWorkSession } from '../hooks/useWorkSession';

const WorkSessionContext = createContext(null);

export function WorkSessionProvider({ children }) {
  const session = useWorkSession();
  return (
    <WorkSessionContext.Provider value={session}>
      {children}
    </WorkSessionContext.Provider>
  );
}

export function useWorkSessionContext() {
  return useContext(WorkSessionContext);
}
