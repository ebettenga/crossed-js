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
      borderWidth: 0.5,
      cornerRadius: 4,
    },
    buttons: {
      hitslop: { top: 2, bottom: 2, left: 0, right: 0 },
    },
  },
  social: {
    reddit: {
      url: "https://www.reddit.com/user/Crossed_Mobile_Game/",
      color: "#FF4500",
    },
    facebook: {
      url: "https://www.facebook.com/share/1B7j2cAFUj/",
      color: "#1877F2",
    },
    instagram: {
      url: "https://www.instagram.com/crossed_mobile_game/",
      color: "#E4405F",
    },
    twitter: {
      url: "https://x.com/crossed11781",
      color: "#1DA1F2",
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
