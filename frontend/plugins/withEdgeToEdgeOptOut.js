const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

// With targetSdk 35, Android 15 enforces edge-to-edge, so adjustResize no
// longer resizes the window and React Native 0.76 never emits keyboard events.
// That leaves KeyboardAvoidingView inert and the keyboard covers text inputs.
// Opting out restores the pre-35 behavior; it is ignored from targetSdk 36 on.
const OPT_OUT = 'android:windowOptOutEdgeToEdgeEnforcement';
const THEMES = ['AppTheme', 'Theme.App.SplashScreen'];

module.exports = function withEdgeToEdgeOptOut(config) {
  return withAndroidStyles(config, (config) => {
    for (const name of THEMES) {
      const style = config.modResults.resources.style?.find(
        (s) => s.$.name === name,
      );
      if (!style) continue;
      config.modResults = AndroidConfig.Styles.assignStylesValue(
        config.modResults,
        {
          add: true,
          parent: { name, parent: style.$.parent },
          name: OPT_OUT,
          value: 'true',
          targetApi: '35',
        },
      );
    }
    return config;
  });
};
