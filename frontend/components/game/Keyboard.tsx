import React from 'react';
import { View, StyleSheet } from 'react-native';
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
    <View style={styles.keyboard}>
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

const styles = StyleSheet.create({
  keyboard: {
    width: '100%',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
}); 