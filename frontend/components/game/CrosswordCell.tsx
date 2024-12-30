import React from 'react';
import { StyleSheet, Dimensions, Pressable, View, Text } from 'react-native';

// Calculate cell size based on screen width
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_SIZE = 15;
const BORDER_WIDTH = 1;
const CELL_SIZE = Math.floor((SCREEN_WIDTH) / GRID_SIZE);
const CORNER_RADIUS = 4;

// Newspaper theme colors
const PAPER_COLOR = '#F5F5EB'; // Slightly off-white, newspaper-like color
const SELECTED_COLOR = '#E6E6DC'; // Slightly darker version of paper color
const BORDER_COLOR = '#2B2B2B'; // Softer than pure black

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
  // Determine if this cell is a corner
  const isTopLeft = coordinates.x === 0 && coordinates.y === 0;
  const isTopRight = coordinates.x === 0 && coordinates.y === GRID_SIZE - 1;
  const isBottomLeft = coordinates.x === GRID_SIZE - 1 && coordinates.y === 0;
  const isBottomRight = coordinates.x === GRID_SIZE - 1 && coordinates.y === GRID_SIZE - 1;

  return (
    <Pressable onPress={onPress}>
      <View 
        style={[
          styles.cell,
          {
            borderRightWidth: coordinates.y === GRID_SIZE - 1 ? BORDER_WIDTH : 0,
            borderBottomWidth: coordinates.x === GRID_SIZE - 1 ? BORDER_WIDTH : 0,
            backgroundColor: isSelected ? SELECTED_COLOR : PAPER_COLOR,
            borderTopLeftRadius: isTopLeft ? CORNER_RADIUS : 0,
            borderTopRightRadius: isTopRight ? CORNER_RADIUS : 0,
            borderBottomLeftRadius: isBottomLeft ? CORNER_RADIUS : 0,
            borderBottomRightRadius: isBottomRight ? CORNER_RADIUS : 0,
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
    </Pressable>
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
    borderColor: BORDER_COLOR,
  },
  selectedCell: {
    borderColor: BORDER_COLOR,
    borderWidth: BORDER_WIDTH,
  },
  letter: {
    fontSize: CELL_SIZE * 0.5,
    fontWeight: '600',
    color: BORDER_COLOR,
    fontFamily: 'Times New Roman', // More newspaper-like font
  },
  foundText: {
    color: BORDER_COLOR,
  },
  hiddenText: {
    color: 'transparent',
  },
}); 