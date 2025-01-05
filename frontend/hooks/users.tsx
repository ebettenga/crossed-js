import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";
import { secureStorage } from "./storageApi";
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, patch } from './api';

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
      return await get('/me');
    },
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
      const res = await post("/signup", data, { auth: false });
      return res;
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
  const router = useRouter();
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
