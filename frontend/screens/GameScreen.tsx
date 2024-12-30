import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import { PlayerInfo } from '../components/game/PlayerInfo';
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameMenu } from '../components/game/GameMenu';
import { useRouter } from 'expo-router';
import { ClueDisplay } from '../components/game/ClueDisplay';

export const GameScreen: React.FC = () => {
    const router = useRouter();
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

    const [showSummary, setShowSummary] = useState(false);

    // Mock game data - in a real app this would come from your game state
    const mockGameResults = {
        players: [
            {
                username: "John Doe",
                lettersCaptured: 12,
                wrongGuesses: 3,
                correctGuessPercent: 80,
                totalPoints: 240,
                winner: true
            },
            {
                username: "Jane Smith",
                lettersCaptured: 8,
                wrongGuesses: 5,
                correctGuessPercent: 61.5,
                totalPoints: 160,
                winner: false
            }
        ]
    };

    const menuOptions = [
        {
            label: 'Quit Game',
            onPress: () => {
                router.push('/(root)/(tabs)');
            },
        },
        {
            label: 'Settings',
            onPress: () => {
                console.log('Open settings');
            },
        },
        {
            label: 'Show Summary',
            onPress: () => {
                console.log('Opening summary...');  // Debug log
                setShowSummary(true);
            },
        },
    ];

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 70 }]}>
            <PlayerInfo
                gameTitle="1v1 Classic"
                players={[
                    {
                        name: "John Doe",
                        elo: 1200,
                        score: 15,
                        isCurrentPlayer: true,
                    },
                    {
                        name: "Jane Smith",
                        elo: 1250,
                        score: 12,
                    },
                    {
                        name: "Jane Smith",
                        elo: 1250,
                        score: 12,
                    },
                ]}
            />
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
            </View>
            <View style={styles.bottomSection}>
                <ClueDisplay 
                    text="4. Something Here that is a Crossword clue."
                />
                <Keyboard
                    onKeyPress={handleKeyPress}
                    disabledKeys={[]}
                />
            </View>
            <GameMenu options={menuOptions} />

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5EB',
    },
    boardContainer: {
        flex: 1,
        alignItems: 'center',
    },
    board: {
        width: '100%',
    },
    bottomSection: {
        width: '100%',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F5F5EB',
    },
    keyboardContainer: {
        width: '100%',
    },
}); 