import React from 'react';
import { View } from 'react-native';
import { KeyboardKey } from './KeyboardKey';

interface KeyboardRowProps {
  keys: string[];
  onKeyPress: (key: string) => void;
  disabledKeys?: string[];
}

export const KeyboardRow: React.FC<KeyboardRowProps> = ({
  keys,
  onKeyPress,
  disabledKeys = []
}) => {
  return (
    <View className="flex-row justify-center my-0.5">
      {keys.map((key) => (
        <KeyboardKey
          key={key}
          letter={key}
          onPress={() => onKeyPress(key)}
          disabled={disabledKeys.includes(key)}
        />
      ))}
    </View>
  );
};
