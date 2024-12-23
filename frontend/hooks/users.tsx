import { useMutation } from "@tanstack/react-query";
import { log, post, storage } from "./api";

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
    storage.set("token", res.access_token);
    storage.set("refresh_token", res.refresh_token);
  },
  onError: (err) => {
    console.log(err);
    log({ error: err }, "error")
  }
});
