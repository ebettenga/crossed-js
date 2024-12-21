import { config } from "@/config/config";
import { useQuery } from "@tanstack/react-query";

export const useCrosswords = () => useQuery({
  queryKey: ["crosswords"],
  queryFn: async () => {
    try {
      console.log(`${config.api.baseURL}/crosswords`);
      const response = await fetch(`${config.api.baseURL}/crosswords`);
      console.log(response);
      console.log(response.status);
      console.log(response.body);
      console.log(response.json());

      return await response.json()
    } catch (error) {
      console.error(error)
    }

  }
})