import { useMutation } from "@tanstack/react-query";
import { post } from "./api";
import { secureStorage } from "./storageApi";
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export type SignInRequest = {
  email: string;
  password: string;
}
type SignInResponse = {
  token_type: string;
  user_id: number;
  access_token: string;
  refresh_token: string;
};



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
  const token = secureStorage.get("token");
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await get('/me');
      return data;
    },
    enabled: !!token,
  });
};

export const useSignIn = () => {
  const router = useRouter();

  return useMutation<SignInResponse, Error, SignInRequest>({
    mutationFn: async (data: SignInRequest) => {
      return await post("/signin", data, { requireAuth: false });
    },
    onSuccess: (res) => {
      secureStorage.set("token", res.access_token);
      secureStorage.set("refresh_token", res.refresh_token);
      router.replace('/(root)/(tabs)');  // Navigate to home screen after successful sign in
    },
    onError: (err) => {
      console.log(err);
    }
  });
};

export const useLogout = () => {
  const router = useRouter();

  return () => {
    secureStorage.remove("token");
    secureStorage.remove("refresh_token");
    router.replace('/');
  };
};
