import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { CrosswordCell } from './CrosswordCell';
import Animated, { 
  FadeInDown,
  Layout,
  LinearTransition,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';

interface CrosswordBoardProps {
  board: string[][];
  foundLetters: string[];
  onCellPress: (coordinates: { x: number; y: number }) => void;
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
  board,
  foundLetters,
  onCellPress,
}) => {
  const renderBoard = () => {
    return board.map((row, x) => (
      <Animated.View 
        key={x} 
        style={styles.row}
        entering={FadeInDown.delay(x * 100)}
        layout={Layout.springify()}
      >
        {row.map((letter, y) => {
          const index = x * row.length + y;
          return (
            <CrosswordCell
              key={`${x}-${y}`}
              letter={letter}
              isFound={foundLetters[index] !== ''}
              onPress={() => onCellPress({ x, y })}
              coordinates={{ x, y }}
            />
          );
        })}
      </Animated.View>
    ));
  };

  return (
    <ScrollView 
      horizontal 
      contentContainerStyle={styles.scrollContainer}
    >
      <ScrollView contentContainerStyle={styles.boardContainer}>
        <Animated.View layout={LinearTransition.springify()}>
          {renderBoard()}
        </Animated.View>
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  boardContainer: {
    padding: 10,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
}); 