import React from 'react';
import { View } from 'react-native';
import { KeyboardRow } from './KeyboardRow';

const KEYBOARD_LAYOUT = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  disabledKeys?: string[];
}

export const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress, disabledKeys = [] }) => {
  return (
    <View
      className="w-full p-2.5 justify-end"
      style={{ flexShrink: 0 }}
    >
      {KEYBOARD_LAYOUT.map((row, index) => (
        <KeyboardRow
          key={index}
          keys={row}
          onKeyPress={onKeyPress}
          disabledKeys={disabledKeys}
        />
      ))}
    </View>
  );
};
