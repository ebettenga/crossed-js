import { TestIds } from "react-native-google-mobile-ads";

export const localConfig = {
  api: {
    baseURL: process.env.EXPO_PUBLIC_API_URL,
    socketURL: process.env.EXPO_PUBLIC_API_SOCKET_URL,
  },
  platform: "com.crossed",
  ads: {
    interstitialAdUnitId: {
      ios: TestIds.INTERSTITIAL,
      android: TestIds.INTERSTITIAL,
    },
    keywords: ["game", "crossword", "puzzle", "word game", "word search", "wordle", "competition"],
  },
};
