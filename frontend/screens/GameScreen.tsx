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

    const [letters] = useState([
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
        'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A', 'B', 'C', 'D',
        'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
        'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
        'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
        'X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
        'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A',
        'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
        'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E',
        'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
        'U', 'V', 'W', 'X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
        'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
        'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'A', 'B',
        'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q'
    ]);

    const [foundLetters] = useState(Array(225).fill('')); // 15x15 = 225
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
        <View style={[styles.container, { paddingBottom: insets.bottom + 70 }]}>
            <View style={styles.boardContainer}>
                <GestureDetector gesture={composed}>
                    <Animated.View
                        style={[styles.board, animatedStyle]}
                        entering={FadeIn}
                    >
                        <CrosswordBoard
                            letters={letters}
                            columnCount={15}
                            foundLetters={foundLetters}
                            onCellPress={handleCellPress}
                            selectedCell={selectedCell}
                        />
                    </Animated.View>
                </GestureDetector>
                <View style={styles.keyboardContainer}>
                    <Keyboard
                        onKeyPress={handleKeyPress}
                        disabledKeys={[]}
                    />
                </View>
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
        alignItems: 'center',
    },
    board: {
        width: '100%',
    },
    keyboardContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
    },
}); 