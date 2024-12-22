import { config } from "@/config/config";
import { useQuery } from "@tanstack/react-query";

export const useCrosswords = () => useQuery({
  queryKey: ["crosswords"],
  queryFn: async () => {
    try {
      console.log(`${config.api.baseURL}/crosswords`);
      const response = await fetch(`${config.api.baseURL}/crosswords`);

      return await response.json()
    } catch (error) {
      console.error(error)
    }

  }
})