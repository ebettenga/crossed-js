import React, { useEffect, useState } from 'react';
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
import { Square, useRoom } from '~/hooks/socket';
import { Text } from 'react-native';





export const GameScreen: React.FC<{ roomId: number }> = ({ roomId }) => {
    const { room, guess } = useRoom(roomId);
    console.log('room', room);

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showSummary, setShowSummary] = useState(false);
    const [selectedCell, setSelectedCell] = useState<Square | null>(null);
    const [isAcrossMode, setIsAcrossMode] = useState(true);

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

    const handleCellPress = (coordinates: Square) => {
        console.log('handleCellPress GameScreen', coordinates);
        setSelectedCell(coordinates);
    };

    const handleKeyPress = (key: string) => {
        if (selectedCell) {
            console.log(`Pressed ${key} for cell:`, selectedCell);
            guess(roomId, { x: selectedCell.x, y: selectedCell.y }, key);
        }
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


    if (!room) {
        console.log('Room not found');
        return <Text>Room not found</Text>;
    }

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 70 }]}>
            <PlayerInfo 
                players={room.players}
                scores={room.scores}
            />
            <View style={styles.boardContainer}>
                <GestureDetector gesture={composed}>
                    <Animated.View
                        style={[styles.board, animatedStyle]}
                        entering={FadeIn}
                    >
                        <CrosswordBoard
                            board={room?.board}
                            onCellPress={handleCellPress}
                            selectedCell={selectedCell || null}
                            isAcrossMode={isAcrossMode}
                            setIsAcrossMode={setIsAcrossMode}
                        />
                    </Animated.View>
                </GestureDetector>
            </View>
            <View style={styles.bottomSection}>
                <ClueDisplay
                    selectedSquare={selectedCell || null}
                    isAcrossMode={isAcrossMode}
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