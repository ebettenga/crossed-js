import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleProp, TextStyle, useColorScheme } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Menu } from 'lucide-react-native';
import { cn } from '~/lib/utils';
import { useColorMode } from '~/hooks/useColorMode';

interface MenuOption {
  label: string;
  onPress: () => void;
  style?: StyleProp<TextStyle>;
}

interface GameMenuProps {
  options: MenuOption[];
}

export const GameMenu: React.FC<GameMenuProps> = ({ options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isDark } = useColorMode();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const menuItemStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(isOpen ? 0 : 100, {
            damping: 12,
            mass: 0.5,
          })
        },
        {
          scale: withSpring(isOpen ? 1 : 0, {
            damping: 12,
            mass: 0.5,
          })
        },
      ],
      opacity: withTiming(isOpen ? 1 : 0, { duration: 200 }),
    };
  });

  const isDangerOption = (style: StyleProp<TextStyle>) => {
    if (typeof style === 'object' && style !== null && 'color' in style) {
      return style.color === '#8B0000';
    }
    return false;
  };

  return (
    <View className="absolute bottom-5 right-4 items-end">
      {/* Menu Options */}
      <Animated.View
        className={cn(
          "absolute bottom-[45px] right-0 bg-white dark:bg-neutral-800",
          "rounded-lg p-2 shadow-lg",
          "border border-neutral-200 dark:border-neutral-700"
        )}
        style={menuItemStyle}
      >
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            className="py-2 px-4 min-w-[120px]"
            onPress={() => {
              option.onPress();
              setIsOpen(false);
            }}
          >
            <Text
              className={cn(
                "text-sm text-[#333333] dark:text-[#DDE1E5] font-['Times_New_Roman']",
                isDangerOption(option.style) && "text-[#8B0000] dark:text-red-400"
              )}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Menu Button */}
      <TouchableOpacity
        className={cn(
          "w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700",
          "justify-center items-center shadow-md"
        )}
        onPress={toggleMenu}
      >
        <Menu size={20} color={isDark ? '#DDE1E5' : '#4A4A4A'} />
      </TouchableOpacity>
    </View>
  );
};
