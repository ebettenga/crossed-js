import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface KeyboardKeyProps {
  letter: string;
  onPress: () => void;
  disabled?: boolean;
}

export const KeyboardKey: React.FC<KeyboardKeyProps> = ({
  letter,
  onPress,
  disabled = false
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (!disabled) {
      scale.value = withSequence(
        withSpring(0.9, { damping: 12 }),
        withSpring(1, { damping: 12 })
      );
      onPress();
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Animated.View 
        style={[
          styles.key,
          disabled && styles.disabled,
          animatedStyle
        ]}
      >
        <Animated.Text style={[
          styles.letter,
          disabled && styles.disabledText
        ]}>
          {letter}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  key: {
    width: 32,
    height: 45,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  disabled: {
    backgroundColor: '#e0e0e0',
  },
  letter: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  disabledText: {
    color: '#999',
  },
}); 