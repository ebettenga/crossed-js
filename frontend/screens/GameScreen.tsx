import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import { PlayerInfo } from '../components/game/PlayerInfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameMenu } from '../components/game/GameMenu';
import { useRouter } from 'expo-router';
import { ClueDisplay } from '../components/game/ClueDisplay';
import { useRoom } from '~/hooks/socket';
import { Square, SquareType } from "~/hooks/useRoom";
import { LoadingGame } from '~/components/game/LoadingGame';
import { GameTimer } from '~/components/game/GameTimer';
import { useUser } from '~/hooks/users';
import { Avatar } from '~/components/shared/Avatar';

export const GameScreen: React.FC<{ roomId: number }> = ({ roomId }) => {
    const { room, guess, refresh, forfeit } = useRoom(roomId);
    const { data: currentUser } = useUser();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [showSummary, setShowSummary] = useState(false);
    const [selectedCell, setSelectedCell] = useState<Square | null>(null);
    const [isAcrossMode, setIsAcrossMode] = useState(true);

    useEffect(() => {
        refresh(roomId);
    }, []);

    if (!room || room.id !== roomId) {
        return <LoadingGame />;
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
            // Start from next column
            let nextY = currentCell.y + 1;
            let currentX = currentCell.x;

            // Keep searching until we find a valid cell or check all positions
            while (true) {
                // If we've reached the end of the row, move to the next row
                if (nextY >= room.board[0].length) {
                    currentX = (currentX + 1) % room.board.length;
                    nextY = 0;
                }

                // If we've wrapped around to the starting position, stop searching
                if (currentX === currentCell.x && nextY === currentCell.y) {
                    return null;
                }

                // Check if current position is a valid cell
                const nextCell = room.board[currentX][nextY];
                if (nextCell.squareType !== SquareType.BLACK && nextCell.squareType !== SquareType.SOLVED) {
                    return nextCell;
                }

                // Move to next column
                nextY++;
            }
        } else {
            // Start from next row
            let nextX = currentCell.x + 1;
            let currentY = currentCell.y;

            // Keep searching until we find a valid cell or check all positions
            while (true) {
                // If we've reached the bottom of the column, move to the next column
                if (nextX >= room.board.length) {
                    currentY = (currentY + 1) % room.board[0].length;
                    nextX = 0;
                }

                // If we've wrapped around to the starting position, stop searching
                if (nextX === currentCell.x && currentY === currentCell.y) {
                    return null;
                }

                // Check if current position is a valid cell
                const nextCell = room.board[nextX][currentY];
                if (nextCell.squareType !== SquareType.BLACK && nextCell.squareType !== SquareType.SOLVED) {
                    return nextCell;
                }

                // Move to next row
                nextX++;
            }
        }
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

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom + 70 }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {currentUser && (
                        <Avatar user={currentUser} size={32} imageUrl={currentUser.avatarUrl} />
                    )}
                    <Text style={styles.title}>{room.crossword.title}</Text>
                </View>
                <GameTimer startTime={room.created_at} />
            </View>
            <PlayerInfo
                players={room.players}
                scores={room.scores}
            />
            <View style={styles.boardContainer}>
                <View style={[styles.board]}>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 10,
        marginBottom: -10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Times New Roman',
        color: '#2B2B2B',
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