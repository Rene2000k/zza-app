import { createContext, useContext } from 'react';
import type { DiagnosticsLog } from './diagnosticsLog';

/** The running display's diagnostics log; null outside a display (tests, preview pages). */
export const DiagnosticsContext = createContext<DiagnosticsLog | null>(null);

export const useDiagnosticsLog = (): DiagnosticsLog | null => useContext(DiagnosticsContext);
