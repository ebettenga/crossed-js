import { useEffect, useState } from 'react';
import { Audio, AVPlaybackSource } from 'expo-av';
import { storage } from './storageApi';

const SOUND_ENABLED_KEY = 'sound-enabled';

export function useSound(soundSource?: AVPlaybackSource) {
    const [sound, setSound] = useState<Audio.Sound>();
    const [isSoundEnabled, setIsSoundEnabled] = useState(true);

    useEffect(() => {
        // Load saved sound preference on mount
        const loadSoundPreference = async () => {
            const savedPreference = await storage.getString(SOUND_ENABLED_KEY);
            if (savedPreference !== null) {
                setIsSoundEnabled(savedPreference === 'true');
            }
        };
        loadSoundPreference();

        // Load the sound
        const loadSound = async () => {
            if (!soundSource) return;
            const { sound } = await Audio.Sound.createAsync(soundSource);
            setSound(sound);
        };
        loadSound();

        // Cleanup
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [soundSource]);

    const setSoundEnabled = async (enabled: boolean) => {
        setIsSoundEnabled(enabled);
        await storage.set(SOUND_ENABLED_KEY, enabled.toString());
    };

    const play = async () => {
        if (!isSoundEnabled || !sound) return;
        try {
            await sound.replayAsync();
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    return {
        isSoundEnabled,
        setSoundEnabled,
        play,
    };
}
