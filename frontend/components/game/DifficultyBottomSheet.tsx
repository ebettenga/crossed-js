import { Swords } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DifficultyBottomSheetProps {
  isOpen: Animated.SharedValue<boolean>;
  onClose: () => void;
  onSelect: (difficulty: 'easy' | 'medium' | 'hard') => void;
}

export const DifficultyBottomSheet: React.FC<DifficultyBottomSheetProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const insets = useSafeAreaInsets();
  const height = useSharedValue(0);
  const progress = useDerivedValue(() =>
    withTiming(isOpen.value ? 0 : 1, { duration: 500 })
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * 2 * height.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    zIndex: isOpen.value ? 1 : withDelay(500, withTiming(-1, { duration: 0 })),
  }));

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={styles.backdropTouchable} onPress={onClose} />
      </Animated.View>
      <Animated.View
        onLayout={(e) => {
          height.value = e.nativeEvent.layout.height;
        }}
        style={[
          styles.sheet,
          sheetStyle,
          {
            paddingTop: 40,
            paddingBottom: insets.bottom + 100,
            bottom: 0,
          }
        ]}>
        <View style={styles.buttonContainer}>
            <View style={styles.titleContainer}>
                <Swords size={24} color="#2B2B2B" style={styles.titleIcon} />
                <Text style={styles.title}>Select Difficulty</Text>
                <Swords size={24} color="#2B2B2B" style={styles.titleIcon} />
            </View>
          <Pressable 
            style={[styles.difficultyButton, styles.easyButton]} 
            onPress={() => onSelect('easy')}
          >
            <Text style={styles.buttonText}>Easy</Text>
          </Pressable>
          <Pressable 
            style={[styles.difficultyButton, styles.mediumButton]} 
            onPress={() => onSelect('medium')}
          >
            <Text style={styles.buttonText}>Medium</Text>
          </Pressable>
          <Pressable 
            style={[styles.difficultyButton, styles.hardButton]} 
            onPress={() => onSelect('hard')}
          >
            <Text style={styles.buttonText}>Hard</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FDFDFD',
    padding: 16,
    width: '100%',
    position: 'absolute',
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    zIndex: 2,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleIcon: {
    marginBottom: 16,

  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 20,
    fontFamily: 'Times New Roman',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    paddingHorizontal: 16,
  },
  difficultyButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  easyButton: {
    backgroundColor: '#059669',
    borderBottomColor: '#047857',
    borderBottomWidth: 3,
  },
  mediumButton: {
    backgroundColor: '#D97706',
    borderBottomColor: '#B45309',
    borderBottomWidth: 3,
  },
  hardButton: {
    backgroundColor: '#DC2626',
    borderBottomColor: '#B91C1C',
    borderBottomWidth: 3,
  },
}); 