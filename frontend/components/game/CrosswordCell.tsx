import React from 'react';
import { StyleSheet, Dimensions, TouchableOpacity, View, Text } from 'react-native';

// Calculate cell size based on screen width
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_SIZE = 15;
const BORDER_WIDTH = 1;
const CELL_SIZE = Math.floor((SCREEN_WIDTH) / GRID_SIZE);

interface CrosswordCellProps {
  letter: string;
  isFound: boolean;
  onPress: () => void;
  coordinates: { x: number; y: number };
  isSelected?: boolean;
}

export const CrosswordCell: React.FC<CrosswordCellProps> = ({
  letter,
  isFound,
  onPress,
  coordinates,
  isSelected = false
}) => {
  return (
    <TouchableOpacity  onPress={onPress}>
      <View 
        style={[
          styles.cell,
          {
            borderRightWidth: coordinates.y === GRID_SIZE - 1 ? BORDER_WIDTH : 0,
            borderBottomWidth: coordinates.x === GRID_SIZE - 1 ? BORDER_WIDTH : 0,
            backgroundColor: isSelected ? '#E0E0E0' : '#ffffff',
          },
          isSelected && styles.selectedCell,
        ]}
      >
        <Text 
          style={[
            styles.letter,
            isFound ? styles.foundText : styles.hiddenText
          ]}
        >
          {letter}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: BORDER_WIDTH,
    borderLeftWidth: BORDER_WIDTH,
    borderColor: '#000000',
  },
  selectedCell: {
    borderColor: '#000000',
    borderWidth: BORDER_WIDTH,
  },
  letter: {
    fontSize: CELL_SIZE * 0.5,
    fontWeight: '600',
    color: '#000000',
  },
  foundText: {
    color: '#000000',
  },
  hiddenText: {
    color: 'transparent',
  },
}); 