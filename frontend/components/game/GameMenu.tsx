import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Menu } from 'lucide-react-native';

interface MenuOption {
  label: string;
  onPress: () => void;
}

interface GameMenuProps {
  options: MenuOption[];
}

export const GameMenu: React.FC<GameMenuProps> = ({ options }) => {
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <View style={styles.container}>
      {/* Menu Options */}
      <Animated.View style={[styles.menuItems, menuItemStyle]}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => {
              option.onPress();
              setIsOpen(false);
            }}
          >
            <Text style={styles.menuText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Menu Button */}
      <TouchableOpacity 
        style={styles.menuButton}
        onPress={toggleMenu}
      >
        <Menu size={20} color="#4A4A4A" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    alignItems: 'flex-end',
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuItems: {
    position: 'absolute',
    bottom: 45,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 120,
  },
  menuText: {
    fontSize: 14,
    color: '#333',
  },
}); 