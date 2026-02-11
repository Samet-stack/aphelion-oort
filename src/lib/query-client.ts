import { QueryClient } from '@tanstack/react-query';

const ONE_MINUTE = 60 * 1000;

interface QueryErrorLike {
  status?: number;
}

const shouldRetry = (failureCount: number, error: unknown): boolean => {
  const status = (error as QueryErrorLike)?.status;
  if (status && status >= 400 && status < 500 && status !== 429) {
    return false;
  }
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ONE_MINUTE,
      gcTime: 10 * ONE_MINUTE,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
});
