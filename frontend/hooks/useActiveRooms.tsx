import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { get } from './api';
import { Room } from './useJoinRoom';

export const useRooms = (status?: 'playing' | 'pending' | 'finished' | 'cancelled', options?: UseQueryOptions<Room[]>) => useQuery<Room[]>({
    queryKey: ['rooms', status],
    queryFn: async () => {
        const params = status ? `?status=${status}` : '';
        const data = await get<Room[]>(`/rooms${params}`);
        return data;
    },
    ...options
});

export const useActiveRooms = (options?: UseQueryOptions<Room[]>) => {
    return useRooms('playing', options);
};

export const usePendingRooms = (options?: UseQueryOptions<Room[]>) => {
    return useRooms('pending', options);
};

export const useFinishedRooms = (options?: UseQueryOptions<Room[]>) => {
    return useRooms('finished', options);
};
