import React from 'react';
import { View, StyleSheet } from 'react-native';
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
    <View style={styles.row}>
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 2,
  },
}); 