import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import { PlayerInfo } from '../components/game/PlayerInfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameMenu } from '../components/game/GameMenu';
import { useRouter } from 'expo-router';
import { ClueDisplay } from '../components/game/ClueDisplay';
import { useRoom } from '~/hooks/socket';
import { Square, SquareType } from "~/hooks/useRoom";
import { Text } from 'react-native';


export const GameScreen: React.FC<{ roomId: number }> = ({ roomId }) => {
    const { room, guess, refresh, forfeit } = useRoom(roomId);
    console.log(room);

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showSummary, setShowSummary] = useState(false);
    const [selectedCell, setSelectedCell] = useState<Square | null>(null);
    const [isAcrossMode, setIsAcrossMode] = useState(true);

    useEffect(() => {
        refresh(roomId);
    }, []);


    if (!room) {
        return <Text>Room not found</Text>;
    }


    const handleCellPress = (coordinates: Square) => {
        setSelectedCell(coordinates);
    };

    const handleKeyPress = (key: string) => {
        if (!selectedCell) {
            return;
        }
        guess(roomId, { x: selectedCell.x, y: selectedCell.y }, key);
        // Move to next cell based on direction
        const nextCell = getNextCell(selectedCell);
        if (nextCell) {
            setSelectedCell(nextCell);
        }
    };

    const getNextCell = (currentCell: Square): Square | null => {
        if (!room?.board) return null;

        if (isAcrossMode) {
            // Move right
            let nextY = currentCell.y + 1;
            while (nextY < room.board[0].length) {
                const nextCell = room.board[currentCell.x][nextY];
                if (nextCell.squareType !== SquareType.BLACK && nextCell.squareType !== SquareType.SOLVED) {
                    return nextCell;
                }
                nextY++;
            }
        } else {
            // Move down
            let nextX = currentCell.x + 1;
            while (nextX < room.board.length) {
                const nextCell = room.board[nextX][currentCell.y];
                if (nextCell.squareType !== SquareType.BLACK && nextCell.squareType !== SquareType.SOLVED) {
                    return nextCell;
                }
                nextX++;
            }
        }
        return null;
    };

    const handleForfeit = () => {
        forfeit(roomId);
        router.push('/(root)/(tabs)');
    };

    const menuOptions = [
        {
            label: 'Home',
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
                setShowSummary(true);
            },
        },
        {
            label: 'Forfeit Game',
            onPress: handleForfeit,
            style: { color: '#8B0000' }
        },
    ];


    if (!room) {
        console.log('Room not found');
        return <Text>Room not found</Text>;
    }




    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 70 }]}>
            <Text style={styles.title}>{room.crossword.title}</Text>
            <PlayerInfo
                players={room.players}
                scores={room.scores}
            />
            <View style={styles.boardContainer}>
                <View
                    style={[styles.board]}
                >
                    <CrosswordBoard
                        board={room?.board}
                        onCellPress={handleCellPress}
                        selectedCell={selectedCell || null}
                        isAcrossMode={isAcrossMode}
                        setIsAcrossMode={setIsAcrossMode}
                        title={room.crossword.title}
                    />
                </View>
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
    title: {
        fontSize: 14,
        fontFamily: 'Times New Roman',
        color: '#2B2B2B',
        paddingTop: 10,
        marginBottom: -10,
        textAlign: 'left',
        paddingHorizontal: 6,
        alignSelf: 'flex-start',
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