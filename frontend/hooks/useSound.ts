import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { AVPlaybackSource } from "expo-av";
import { storage } from "./storageApi";

const SOUND_ENABLED_KEY = "sound-enabled";
const isRunningInJest = typeof process !== "undefined" &&
  process.env.JEST_WORKER_ID !== undefined;
const isNativeAudioSupported = !isRunningInJest &&
  (Platform.OS === "ios" || Platform.OS === "android");

type ExpoAudioSound = import("expo-av").Audio.Sound;

export function useSound(soundSource?: AVPlaybackSource) {
  const [sound, setSound] = useState<ExpoAudioSound>();
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  useEffect(() => {
    // Load saved sound preference on mount
    const loadSoundPreference = async () => {
      const savedPreference = await storage.getString(SOUND_ENABLED_KEY);
      if (savedPreference !== null) {
        setIsSoundEnabled(savedPreference === "true");
      }
    };
    loadSoundPreference();

    // Load the sound only on native platforms
    let isActive = true;
    let loadedSound: ExpoAudioSound | undefined;

    const loadSound = async () => {
      if (!isNativeAudioSupported || !soundSource) {
        setSound(undefined);
        return;
      }

      try {
        const { Audio } = await import("expo-av");
        const { sound } = await Audio.Sound.createAsync(soundSource);
        loadedSound = sound;

        if (isActive) {
          setSound(sound);
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error("Failed to load sound:", error);
      }
    };

    loadSound();

    return () => {
      isActive = false;
      if (loadedSound) {
        loadedSound.unloadAsync().catch((error) => {
          console.error("Failed to unload sound:", error);
        });
      }
    };
  }, [soundSource]);

  const setSoundEnabled = async (enabled: boolean) => {
    setIsSoundEnabled(enabled);
    await storage.set(SOUND_ENABLED_KEY, enabled.toString());
  };

  const play = async () => {
    if (!isNativeAudioSupported || !isSoundEnabled || !sound) return;
    try {
      await sound.replayAsync();
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  };

  return {
    isSoundEnabled,
    setSoundEnabled,
    play,
  };
}
