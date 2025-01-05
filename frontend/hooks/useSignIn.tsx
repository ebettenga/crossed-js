import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";
import { secureStorage } from "./storageApi";

type SignInCredentials = {
  email: string;
  password: string;
}

export const useSignIn = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (credentials: SignInCredentials) => {
      console.log({ message: 'Signing in', credentials }, 'info');
      const { data } = await post<any>('/auth/signin', credentials, { auth: false });
      console.log({ message: 'Sign in successful', userId: data.user_id }, 'info');
      return data;
    },
    onSuccess: (data) => {
      secureStorage.set('token', data.token);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}; 