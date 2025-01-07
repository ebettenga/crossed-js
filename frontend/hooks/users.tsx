import { useMutation, useQueryClient } from "@tanstack/react-query";
import { secureStorage } from "./storageApi";
import { router, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, patch, post } from './api';

export type SignInRequest = {
  email: string;
  password: string;
}

export type SignUpRequest = {
  email: string;
  password: string;
  username: string;
}

type SignInResponse = {
  token_type: string;
  user_id: number;
  access_token: string;
  refresh_token: string;
  user: User;
};

export type User = {
  id: number;
  username: string;
  created_at: string;
  email: string;
  roles: string[];
  description: string | null;
  photo?: string | null;
  photoContentType?: string | null;
  eloRating: number;
  gamesWon: number;
  gamesLost: number;
  guessAccuracy: number;
  winRate: number;
};

export const useUser = () => {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const response = await get<User>('/me');
        if (response.photo && response.photoContentType) {
          // Convert the base64 string to a data URL
          response.photo = `data:${response.photoContentType};base64,${response.photo}`;
        }
        return response;
      } catch (error: any) {
        if (error.message === 'Forbidden' || error.message === 'Unauthorized') {
          await secureStorage.remove('token');
        }
        throw error;
      }
    },
    retry: 1,

  });
};

export const useSignIn = () => {
  const queryClient = useQueryClient();
  return useMutation<SignInResponse, Error, SignInRequest>({
    mutationFn: async (data: SignInRequest) => {
      return await post("/signin", data, { auth: false });
    },
    onSuccess: (res) => {
      secureStorage.set("token", res.access_token);
      secureStorage.set("refresh_token", res.refresh_token);
      queryClient.setQueryData(['me'], res.user);
    },
    onError: (err) => {
      console.error(err);
    }
  });
};

export const useSignUp = () => {
  const queryClient = useQueryClient();
  return useMutation<SignInResponse, Error, SignUpRequest>({
    mutationFn: async (data: SignUpRequest) => {
      return await post<SignInResponse>("/signup", data, { auth: false });
    },
    onSuccess: (res) => {
      secureStorage.set("token", res.access_token);
      secureStorage.set("refresh_token", res.refresh_token);
      queryClient.setQueryData(['me'], res.user);
    },
    onError: (err) => {
      console.error(err);
    }
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return async () => {
    await secureStorage.remove("token");
    await secureStorage.remove("refresh_token");
    queryClient.clear();
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.removeQueries({ queryKey: ['me'] });
    queryClient.setQueryData(['me'], null);
    router.replace('/(auth)/signin');
  };
};

export type UpdateUserRequest = {
  username?: string;
  email?: string;
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation<User, Error, UpdateUserRequest>({
    mutationFn: async (data: UpdateUserRequest) => {
      return await patch('/me', data);
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser);
    },
  });
};

interface GameStats {
  id: number;
  userId: number;
  roomId: number;
  correctGuesses: number;
  incorrectGuesses: number;
  correctGuessDetails: {
    row: number;
    col: number;
    letter: string;
    timestamp: Date;
  }[];
  isWinner: boolean;
  winStreak: number;
  eloAtGame: number;
  createdAt: Date;
}


export function useUserGameStats(startTime?: Date, endTime?: Date) {

  return useQuery<GameStats[]>({
      queryKey: ['userGameStats', startTime?.toISOString(), endTime?.toISOString()],
      queryFn: async () => {
          const params: Record<string, string> = {};
          if (startTime) params.startTime = startTime.toISOString();
          if (endTime) params.endTime = endTime.toISOString();
          return await get('/stats/me', { params });
      },
      staleTime: 1000 * 60 * 10,
  });
}

export const useUpdatePhoto = () => {
  const queryClient = useQueryClient();
  return useMutation<User, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      return await post('/me/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser);
    },
  });
};
