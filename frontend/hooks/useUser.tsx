import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import { Player } from './socket';


export type User = {
  id: number;
  username: string;
  created_at: string;
  email: string;
  roles: string[];
  description: string | null;
  eloRating: number;
};


export const useUser = () => {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await get('/me');
      return data;
    },
  });
}; 