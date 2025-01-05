export const theme = {
  colors: {
    // Base colors
    primary: {
      DEFAULT: '#8B0000', // Dark red from GameBanner
      light: '#FEE2E2',
      lighter: '#FFF5F5',
      border: '#FECACA',
    },
    background: {
      DEFAULT: '#FFFFFF',
      secondary: '#F8F8F5',
      tertiary: '#F5F5F5',
    },
    text: {
      DEFAULT: '#2B2B2B',
      secondary: '#666666',
    },
    border: {
      DEFAULT: '#E5E5E5',
      light: '#EBEBEB',
    },
    status: {
      success: '#34D399',
      error: '#EF4444',
    }
  },
  // Add other theme properties as needed
  fontFamily: {
    serif: 'Times New Roman',
  }
} as const;
