import { useMutation } from "@tanstack/react-query";
import { log, post } from "./api";
import { secureStorage } from "./storageApi";
import { useRouter } from 'expo-router';

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

export const useSignIn = () => useMutation<SignInResponse, Error, SignInRequest>({
  mutationFn: async (data: SignInRequest) => {
    return await post("/signin", data);
  },
  onSuccess: (res) => {
    secureStorage.set("token", res.access_token);
    secureStorage.set("refresh_token", res.refresh_token);
  },
  onError: (err) => {
    console.log(err);
    log({ error: err }, "error")
  }
});

export const useLogout = () => {
  const router = useRouter();

  return () => {
    secureStorage.remove("token");
    secureStorage.remove("refresh_token");
    router.replace('/');  
  };
};
