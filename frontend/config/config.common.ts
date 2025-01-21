import { theme } from "./theme";

export const commonConfig = {
  theme,
  ads: {
    keywords: [
      "game",
      "crossword",
      "puzzle",
      "word game",
      "word search",
      "wordle",
      "competition",
    ],
  },
  game: {
    crossword: {
      gridSize: 15,
      borderWidth: 1,
      cornerRadius: 4,
    },
  },
  superwall: {
    ios: {
      apiKey: process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY,
    },
    android: {
      apiKey: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY,
    },
  },
};
