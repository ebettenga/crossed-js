import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ELO_VISIBILITY_KEY = '@crossed_js:elo_visibility';

export const useEloVisibility = () => {
    const [isEloVisible, setIsEloVisible] = useState(true);

    useEffect(() => {
        // Load saved preference
        const loadEloVisibility = async () => {
            try {
                const savedValue = await AsyncStorage.getItem(ELO_VISIBILITY_KEY);
                if (savedValue !== null) {
                    setIsEloVisible(JSON.parse(savedValue));
                }
            } catch (error) {
                console.error('Error loading ELO visibility:', error);
            }
        };

        loadEloVisibility();
    }, []);

    const setEloVisibility = async (value: boolean) => {
        try {
            await AsyncStorage.setItem(ELO_VISIBILITY_KEY, JSON.stringify(value));
            setIsEloVisible(value);
        } catch (error) {
            console.error('Error saving ELO visibility:', error);
        }
    };

    return {
        isEloVisible,
        setEloVisibility
    };
};
