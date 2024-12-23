import { config } from "@/config/config";
import { useQuery } from "@tanstack/react-query";

export const useCrosswords = () => useQuery({
  queryKey: ["crosswords"],
  queryFn: async () => {
    try {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIwLCJyb2xlcyI6WyJ1c2VyIl0sImlhdCI6MTczNDkyNzIwMiwiZXhwIjoxNzM0OTMwODAyfQ.bzXfTF3m8AoUGAHVWVIzOXJZXphqx61JjQQVP2InEts";
      console.log(`${config.api.baseURL}/crosswords`);
      const response = await fetch(`${config.api.baseURL}/crosswords`, {
        headers: {
          "authorization": `Bearer ${token}`
        }
      });

      return await response.json()
    } catch (error) {
      console.error(error)
    }

  }
})