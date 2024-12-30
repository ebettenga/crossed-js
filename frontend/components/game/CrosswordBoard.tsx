import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { CrosswordCell } from './CrosswordCell';
import Animated, { 
  FadeIn,
  Layout,
  LinearTransition,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CrosswordBoardProps {
  letters: string[];
  columnCount: number;
  foundLetters: string[];
  onCellPress: (coordinates: { x: number; y: number }) => void;
  selectedCell?: { x: number; y: number } | null;
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
  letters,
  columnCount,
  foundLetters,
  onCellPress,
  selectedCell
}) => {
  const insets = useSafeAreaInsets();

  // Memoize the board rendering to prevent unnecessary re-renders
  const board = useMemo(() => {
    const rows = [];
    for (let x = 0; x < letters.length / columnCount; x++) {
      const rowLetters = letters.slice(x * columnCount, (x + 1) * columnCount);
      rows.push(
        <Animated.View 
          key={x} 
          style={styles.row}
          entering={FadeIn.delay(x * 25).springify()} // Reduced delay and combined with spring
          layout={LinearTransition.springify()}
        >
          {rowLetters.map((letter, y) => {
            const index = x * columnCount + y;
            const isSelected = selectedCell?.x === x && selectedCell?.y === y;
            return (
              <CrosswordCell
                key={`${x}-${y}`}
                letter={letter}
                isFound={foundLetters[index] !== ''}
                onPress={() => onCellPress({ x, y })}
                coordinates={{ x, y }}
                isSelected={isSelected}
              />
            );
          })}
        </Animated.View>
      );
    }
    return rows;
  }, [letters, columnCount, foundLetters, selectedCell, onCellPress]);

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: insets.top + 20 }
        ]}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true} // Optimize scrolling performance
      >
        <ScrollView 
          contentContainerStyle={styles.boardContainer}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
        >
          <Animated.View layout={LinearTransition.springify()}>
            {board}
          </Animated.View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    minWidth: SCREEN_WIDTH,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  boardContainer: {
    padding: 5,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
}); 