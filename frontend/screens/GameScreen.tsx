import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import Animated, { 
  FadeIn,
  useAnimatedStyle, 
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GameScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  console.log("GameScreen")
  const [board] = useState([
    ['H', 'E', 'L', 'L', 'O'],
    ['W', 'O', 'R', 'L', 'D'],
    ['T', 'E', 'S', 'T', 'S'],
    ['G', 'A', 'M', 'E', 'S'],
    ['P', 'L', 'A', 'Y', 'S'],
  ]);

  const [foundLetters] = useState(Array(25).fill(''));
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>(null);
  
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const rotateGesture = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = e.rotation;
    })
    .onEnd(() => {
      rotation.value = withSpring(0);
    });

  const composed = Gesture.Simultaneous(pinchGesture, rotateGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  const handleCellPress = (coordinates: { x: number; y: number }) => {
    setSelectedCell(coordinates);
  };

  const handleKeyPress = (key: string) => {
    if (selectedCell) {
      console.log(`Pressed ${key} for cell:`, selectedCell);
      // Add your guess logic here
    }
  };

  return (
    <View style={[
      styles.container,
      { paddingBottom: insets.bottom + 70 } // 70 is the tab bar height
    ]}>
      <View style={styles.boardContainer}>
        <GestureDetector gesture={composed}>
          <Animated.View 
            style={[styles.board, animatedStyle]}
            entering={FadeIn}
          >
            <CrosswordBoard
              board={board}
              foundLetters={foundLetters}
              onCellPress={handleCellPress}
              selectedCell={selectedCell}
            />
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.keyboardContainer}>
        <Keyboard 
          onKeyPress={handleKeyPress}
          disabledKeys={[]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  board: {
    alignItems: 'center',
  },
  keyboardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
  },
}); 