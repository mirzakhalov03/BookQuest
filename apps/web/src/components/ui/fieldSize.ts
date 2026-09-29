import { createContext, useContext } from 'react';

export type FieldSize = 'roomy' | 'compact';

/** Participant screens keep big, thumb-friendly inputs; the admin console provides `compact`. */
export const FieldSizeContext = createContext<FieldSize>('roomy');

export const useFieldSize = () => useContext(FieldSizeContext);
