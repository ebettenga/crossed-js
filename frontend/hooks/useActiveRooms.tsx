import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import { Room } from './socket';

export const useRooms = (status?: 'playing' | 'pending' | 'finished' | 'cancelled') => {
  return useQuery<Room[]>({
    queryKey: ['rooms', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      return await get(`/rooms${params}`);
    },
  });
};

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
