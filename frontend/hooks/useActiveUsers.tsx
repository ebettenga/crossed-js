import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export const useActiveUsers = () => useQuery({
    queryKey: ['activeUsers'],
    queryFn: async () => {
        const response = await get<{ count: number }>('/users/active');
        return response.count;
    },
    refetchInterval: 60000, // Refetch every minute
    refetchIntervalInBackground: true,
});
