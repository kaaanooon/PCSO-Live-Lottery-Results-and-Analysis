import { createContext, useContext } from 'react';

export type ResultReminderStatus =
  | 'loading'
  | 'scheduled'
  | 'disabled'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface EnableResultRemindersResult {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

export interface ResultRemindersContextValue {
  readonly available: boolean;
  readonly status: ResultReminderStatus;
  readonly permissionCanAskAgain: boolean;
  readonly enableReminders: () => Promise<EnableResultRemindersResult>;
  readonly disableReminders: () => Promise<void>;
  readonly openNotificationSettings: () => Promise<void>;
}

export const ResultRemindersContext = createContext<ResultRemindersContextValue | undefined>(
  undefined,
);

export function useResultReminders(): ResultRemindersContextValue {
  const context = useContext(ResultRemindersContext);
  if (!context) {
    throw new Error('useResultReminders must be used inside a ResultRemindersProvider.');
  }
  return context;
}
