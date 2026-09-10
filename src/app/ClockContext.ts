import { createContext } from 'react';
import type { Clock } from '@/platform/clock';
import { systemClock } from '@/platform/clock';

/**
 * The clock every component reads from (ADR-0004). Defaults to real time so a
 * component rendered outside a provider still behaves, rather than crashing.
 */
export const ClockContext = createContext<Clock>(systemClock);
