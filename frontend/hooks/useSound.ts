import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

type SoundSource = number; // require('...') returns number in RN/Expo
export type SoundMap<TKeys extends string = string> = Record<
  TKeys,
  SoundSource
>;

export interface UseSoundOptions {
  enabled?: boolean;
  volume?: number; // 0..1
  preload?: string[]; // keys to preload
}

export interface PlayOptions {
  loop?: boolean;
}

export interface UseSoundResult<TKeys extends string> {
  play: (key: TKeys, options?: PlayOptions) => Promise<void>;
  setLooping: (key: TKeys, looping: boolean) => Promise<void>;
  preload: (keys?: TKeys[]) => Promise<void>;
  unload: (keys?: TKeys[]) => Promise<void>;
  stop: (key: TKeys) => Promise<void>;
  isLoaded: (key: TKeys) => boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
}

export function useSound<TKeys extends string>(
  sounds: SoundMap<TKeys>,
  options: UseSoundOptions = {},
): UseSoundResult<TKeys> {
  const [enabled, setEnabled] = useState(options.enabled ?? true);
  const [volume, setVolume] = useState(
    Math.min(1, Math.max(0, options.volume ?? 1)),
  );

  // Sync internal enabled state with external option updates
  useEffect(() => {
    if (typeof options.enabled === "boolean") {
      setEnabled(options.enabled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled]);

  const instances = useRef(new Map<TKeys, Audio.Sound>());
  const loading = useRef(new Map<TKeys, Promise<Audio.Sound>>());
  const playingInstances = useRef(new Set<TKeys>());

  useEffect(() => {
    // Configure audio mode once
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Apply volume to all loaded instances
    const tasks: Promise<void>[] = [];
    instances.current.forEach((sound) => {
      tasks.push(sound.setVolumeAsync(volume).then(() => {}, () => {}));
    });
    if (tasks.length) {
      Promise.allSettled(tasks);
    }
  }, [volume]);

  useEffect(() => {
    // Preload optionally
    if (options.preload?.length) {
      options.preload.forEach((k) => {
        // @ts-expect-error runtime key string vs TKeys
        loadInstance(k);
      });
    }
    return () => {
      // Unload all on unmount
      console.log("[useSound] Component unmounting, unloading all sounds");
      unload().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInstance = useCallback(async (key: TKeys): Promise<Audio.Sound> => {
    const existing = instances.current.get(key);
    if (existing) return existing;

    const inFlight = loading.current.get(key);
    if (inFlight) return inFlight;

    const source = sounds[key];
    if (!source) throw new Error(`useSound: unknown key "${String(key)}"`);

    const loadPromise = (async () => {
      const { sound } = await Audio.Sound.createAsync(
        source,
        { volume, shouldPlay: false },
        undefined,
        true,
      );
      instances.current.set(key, sound);
      loading.current.delete(key);
      return sound;
    })();

    loading.current.set(key, loadPromise);
    try {
      return await loadPromise;
    } catch (e) {
      loading.current.delete(key);
      throw e;
    }
  }, [sounds, volume]);

  const play = useCallback(async (key: TKeys, options?: PlayOptions) => {
    if (!enabled) return;
    console.log(`[useSound] Playing sound: ${String(key)}`);
    const sound = await loadInstance(key);
    const loop = !!options?.loop;

    // Mark as playing
    playingInstances.current.add(key);

    try {
      await sound.setIsLoopingAsync(loop);
    } catch {}
    if (!loop) {
      try {
        await sound.setPositionAsync(0);
      } catch {}
    }

    // Set up callback to mark as not playing when finished
    if (!loop) {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log(`[useSound] Sound finished: ${String(key)}`);
          playingInstances.current.delete(key);
          // Clear the callback to prevent memory leaks
          sound.setOnPlaybackStatusUpdate(null);
        }
      });
    }

    await sound.replayAsync();
    console.log(`[useSound] Sound started: ${String(key)}`);
  }, [enabled, loadInstance]);

  const setLooping = useCallback(async (key: TKeys, looping: boolean) => {
    const sound = instances.current.get(key) ?? (await loadInstance(key));
    try {
      await sound.setIsLoopingAsync(looping);
    } catch {}
  }, [loadInstance]);

  const stop = useCallback(async (key: TKeys) => {
    const sound = instances.current.get(key) ?? (await loadInstance(key));
    playingInstances.current.delete(key);
    try {
      await sound.stopAsync();
    } catch {}
  }, [loadInstance]);

  const preload = useCallback(async (keys?: TKeys[]) => {
    const toLoad = keys && keys.length
      ? keys
      : (Object.keys(sounds) as TKeys[]);
    await Promise.all(toLoad.map((k) => loadInstance(k).then(() => undefined)));
  }, [loadInstance, sounds]);

  const unload = useCallback(async (keys?: TKeys[]) => {
    const targets = keys && keys.length
      ? keys
      : (Array.from(instances.current.keys()) as TKeys[]);
    console.log(`[useSound] Unloading sounds:`, targets);
    await Promise.all(
      targets.map(async (k) => {
        // Skip unloading if sound is currently playing
        if (playingInstances.current.has(k)) {
          console.log(
            `[useSound] Skipping unload for playing sound: ${String(k)}`,
          );
          return;
        }

        const s = instances.current.get(k);
        if (s) {
          instances.current.delete(k);
          try {
            console.log(`[useSound] Unloading sound: ${String(k)}`);
            await s.unloadAsync();
          } catch {}
        }
        const lf = loading.current.get(k);
        if (lf) {
          loading.current.delete(k);
        }
      }),
    );
  }, []);

  const isLoaded = useCallback((key: TKeys) => instances.current.has(key), []);

  return useMemo(
    () => ({
      play,
      setLooping,
      preload,
      unload,
      stop,
      isLoaded,
      enabled,
      setEnabled,
      volume,
      setVolume,
    }),
    [enabled, play, setLooping, preload, unload, stop, isLoaded, volume],
  );
}

export default useSound;
