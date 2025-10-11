export const pencilSounds = {
  pencil1: require("./pencil-sound-1.wav"),
  pencil2: require("./pencil-sound-2.wav"),
  pencil3: require("./pencil-sound-3.wav"),
} as const;

export type PencilSoundKey = keyof typeof pencilSounds;

export function randomPencilKey(): PencilSoundKey {
  const keys = Object.keys(pencilSounds) as PencilSoundKey[];
  return keys[Math.floor(Math.random() * keys.length)];
}
