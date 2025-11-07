import React from 'react';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { cn } from '~/lib/utils';

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
        className={cn(
          "w-8 h-[45px] bg-white dark:bg-neutral-700 justify-center items-center m-0.5 rounded border",
          "border-neutral-200 dark:border-neutral-600",
          disabled && "bg-neutral-200 dark:bg-neutral-800"
        )}
        style={animatedStyle}
      >
        <Animated.Text
          className={cn(
            "text-lg font-semibold text-[#333333] dark:text-[#DDE1E5] font-rubik",
            disabled && "text-neutral-400 dark:text-neutral-500"
          )}
          style={{ transform: [{ translateY: 1.5 }] }}
        >
          {letter}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};
