import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  withTiming,
  interpolateColor,
  useSharedValue,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface CrosswordCellProps {
  letter: string;
  isFound: boolean;
  onPress: () => void;
  coordinates: { x: number; y: number };
}

export const CrosswordCell: React.FC<CrosswordCellProps> = ({
  letter,
  isFound,
  onPress,
  coordinates
}) => {
  const scale = useSharedValue(1);
  const backgroundColor = useSharedValue(0);
  const opacity = useSharedValue(isFound ? 1 : 0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(
      backgroundColor.value,
      [0, 1],
      ['#f0f0f0', '#90EE90']
    ),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.9, { damping: 12 }),
      withSpring(1, { damping: 12 })
    );

    if (isFound) {
      backgroundColor.value = withTiming(1, {
        duration: 300
      });
      opacity.value = withSpring(1);
    }

    onPress();
  };
  console.log(letter)
  return (
    <TouchableOpacity onPress={handlePress}>
      <Animated.View 
        entering={FadeIn}
        style={[styles.cell, animatedStyle]}
      >
        <Animated.Text 
          style={[
            styles.letter,
            textStyle
          ]}
        >
          {letter}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cell: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    margin: 2,
    borderRadius: 8,
  },
  letter: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333333',
  },
  foundText: {
    color: '#000',
  },
  hiddenText: {
    color: 'transparent',
  },
}); 