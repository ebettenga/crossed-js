module.exports = {
  "expo": {
    "name": "Crossed",
    "slug": "crossed",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "crossed",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.bettengasolutions.crossed"
    },
    "android": {
      "googleServicesFile": process.env.GOOGLE_SERVICES_JSON ??"./google-services.json",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/icon.png",
        "backgroundColor": "#92979b"
      },
      "package": "com.bettengasolutions.crossed"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-notifications",
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "buildToolsVersion": "35.0.0",
            "minSdkVersion": 26
          }
        }
      ],
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "resizeMode": "cover",
          "backgroundColor": "#000000",
          "enableFullScreenImage_legacy": true
        }
      ],
      [
        "expo-font",
        {
          "fonts": [
            "./assets/fonts/Rubik-Bold.ttf",
            "./assets/fonts/Rubik-ExtraBold.ttf",
            "./assets/fonts/Rubik-Medium.ttf",
            "./assets/fonts/Rubik-Light.ttf",
            "./assets/fonts/Rubik-Regular.ttf",
            "./assets/fonts/Rubik-SemiBold.ttf"
          ]
        }
      ],
      "expo-secure-store"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "370ab06a-bcfe-462d-a5b4-4eccc7638a70"
      }
    },
    "owner": "bettet01"
  }
}
