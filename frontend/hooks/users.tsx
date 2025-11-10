import { useMutation, useQueryClient } from "@tanstack/react-query";
import { secureStorage } from "./storageApi";
import { router, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { get, patch, post, del } from './api';
import Toast from "react-native-toast-message";
import usePushNotifications, { getStoredExpoPushToken } from "./usePushNotifications";





export type SignInRequest = {
  credential: string;
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
        const token = await secureStorage.get("token");
        if (!token) {
          throw new Error("No token");
        }

        const response = await get<User>('/me');
        if (response.photo && response.photoContentType) {
          // Convert the base64 string to a data URL
          response.photo = `data:${response.photoContentType};base64,${response.photo}`;
        }
        return response;
      } catch (error: any) {
        if (error.message === 'Forbidden' || error.message === 'Unauthorized' || error.message === 'No token') {
          await secureStorage.remove('token');
          await secureStorage.remove('refresh_token');
          router.replace('/(auth)/signin');
        }
        throw error;
      }
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
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
      Toast.show({
        text1: 'Invalid email or password',
        type: 'error',
      });
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
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const {
    token: currentPushToken,
    clearStoredToken: clearStoredPushTokenState,
  } = usePushNotifications();

  return async () => {
    const storedPushToken =
      currentPushToken ?? (await getStoredExpoPushToken());

    if (storedPushToken) {
      try {
        await del("/users/push-tokens", { token: storedPushToken });
      } catch (error) {
        console.warn("Failed to remove Expo push token during logout", error);
      }
    }

    await clearStoredPushTokenState();
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

export function useUpdatePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) => {
      const response = await post<{ message: string }>('/users/change-password', {
        oldPassword,
        newPassword,
      });
      return response;
    },
    onSuccess: () => {
      Toast.show({
        text1: 'Password changed successfully',
        type: 'success',
      });
    },
    onError: () => {
      Toast.show({
        text1: 'Something went wrong. If this problem persists, please contact support.',
        type: 'error',
      });
    }
  });
}
