import React, { useEffect, useState } from 'react';
import Superwall, { TransactionBackgroundView } from '@superwall/react-native-superwall';
import { Platform } from 'react-native';
import { config } from '@/config/config';

export const useSuperwall = () => {
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const apiKey = Platform.OS === 'ios' ? config.superwall.ios.apiKey : config.superwall.android.apiKey;

        if (!apiKey) {
            console.error('Superwall API key not found in environment variables');
            return;
        }


        Superwall.configure(apiKey)
            .then(() => {
                console.log('Superwall configured successfully');
                Superwall.shared.setDelegate({
                    subscriptionStatusDidChange: () => {
                        console.log('Subscription status changed');
                    },
                    handleSuperwallEvent: (event) => {
                        console.log('Superwall event:', event);
                    },
                    handleCustomPaywallAction: (action) => {
                        console.log('Custom paywall action:', action);
                    },
                    willDismissPaywall: () => {
                        console.log('Paywall will dismiss');
                    },
                    willPresentPaywall: () => {
                        console.log('Paywall will present');
                    },
                    didDismissPaywall: () => {
                        console.log('Paywall did dismiss');
                    },
                    didPresentPaywall: () => {
                        console.log('Paywall did present');
                    },
                    paywallWillOpenURL: (url) => {
                        console.log('Paywall will open URL:', url);
                    },
                    paywallWillOpenDeepLink: (deepLink) => {
                        console.log('Paywall will open deep link:', deepLink);
                    },
                    handleLog: (log) => {
                        console.log('Superwall log:', log);
                    },
                });
                // Preload paywalls after configuration
                return Superwall.shared.preloadAllPaywalls();
            })
            .then(() => {
                console.log('Paywalls preloaded');
                setIsInitialized(true);
            })
            .catch(error => console.error('Superwall configuration error:', error));
    }, []);

    const register = async (paywallId: string) => {
        if (!isInitialized) {
            console.error('Superwall is not initialized.');
            return;
        }

        console.log("Attempting to present paywall:", paywallId);

        try {
            // Present the paywall
            const result = await Superwall.shared.register(paywallId);
            console.log("Paywall presentation result:", result);

            return result;
        } catch (error) {
            console.error('Error presenting paywall:', error);
        }
    };

    return { isInitialized, register };
};

export default useSuperwall;