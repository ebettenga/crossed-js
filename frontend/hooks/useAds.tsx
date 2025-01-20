import { useEffect, useState } from 'react';
import mobileAds, { InterstitialAd, TestIds, AdEventType } from 'react-native-google-mobile-ads';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxx/yyyyyyyyyy';

export const useAds = () => {
  const [initialized, setInitialized] = useState(false);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const [interstitial, setInterstitial] = useState<InterstitialAd | null>(null);

  useEffect(() => {
    // Initialize the Mobile Ads SDK
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        setInitialized(true);
        // Load initial interstitial
        loadInterstitial();
      });
  }, []);

  const loadInterstitial = () => {
    const newInterstitial = InterstitialAd.createForAdRequest(adUnitId);

    newInterstitial.addAdEventListener(AdEventType.LOADED, () => {
      setInterstitialLoaded(true);
    });

    newInterstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setInterstitialLoaded(false);
      // Load the next interstitial
      loadInterstitial();
    });

    newInterstitial.load();
    setInterstitial(newInterstitial);
  };

  const showInterstitial = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!interstitialLoaded || !interstitial) {
        resolve(false);
        return;
      }

      interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        resolve(true);
      });

      interstitial.show();
    });
  };

  return {
    initialized,
    showInterstitial,
    interstitialLoaded
  };
};
