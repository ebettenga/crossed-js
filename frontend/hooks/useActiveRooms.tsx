import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import { Room } from './useRoom';

export const useRooms = (status?: 'playing' | 'pending' | 'finished' | 'cancelled') => useQuery<Room[]>({
    queryKey: ['rooms', status],
    queryFn: async () => {
        const params = status ? `?status=${status}` : '';
        const data = await get(`/rooms${params}`);
        return data;
    },
    refetchInterval: 1000,
});

// For backwards compatibility, keep the useActiveRooms hook
export const useActiveRooms = () => {
    return useRooms('playing');
};

export const usePendingRooms = () => {
    return useRooms('pending');
};

export const useFinishedRooms = () => {
    return useRooms('finished');
};
