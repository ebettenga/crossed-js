import { useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from './api';

export type LogSeverity = 'info' | 'warn' | 'error'

export interface LogInput {
  log: {};
  severity: LogSeverity;
}

export interface Log extends LogInput {
  id: number;
  created_at: Date;
}

/**
 * Custom React Query mutation hook for creating log entries.
 *
 * ⚠️ This hook can only be used within an **authenticated context**,
 * because logs are stored privately and require a valid access token.
 *
 * @function useLogger
 * @returns {UseMutationResult<Log, Error, LogInput>} A React Query mutation object for logging events.
 *
 * @example
 * const logger = useLogger();
 * logger.mutate({ log: { note: "Something happened" }, severity: "info" });
 */
export const useLogger = () => {
  return useMutation({
    mutationFn: async (body: LogInput) => await post<Log>('/logs', body),
    onSuccess: (data) => {
      console.log(data);
    },
  });
};
