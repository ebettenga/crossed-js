import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import { Room } from './socket';

export const useActiveRooms = () => {
  return useQuery<Room[]>({
    queryKey: ['activeRooms'],
    queryFn: async () => {
      return await get('/rooms/active');
    },
  });
}; 