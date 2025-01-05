export const commonConfig = {
    game: {
        crossword: {
            gridSize: 15,
            borderWidth: 1,
            cornerRadius: 4,
            colors: {
              paper: '#F5F5EB',
              selected: '#E6E6DC',
              border: '#2B2B2B'
            }
          }
    },
    superwall: {
        ios: {
            apiKey: process.env.EXPO_PUBLIC_SUPERWALL_IOS_API_KEY,
        },
        android: {
            apiKey: process.env.EXPO_PUBLIC_SUPERWALL_ANDROID_API_KEY,
        }
    }
};
