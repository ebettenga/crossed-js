import { useQuery } from "@tanstack/react-query";
import { get } from "./api";

export const useCrosswords = () => useQuery({
  queryKey: ["crosswords"],
  queryFn: () => { return get('/crosswords').then(data => data) }
})