import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import { PlayerInfo } from '../components/game/PlayerInfo';
import { GameMenu } from '../components/game/GameMenu';
import { useRouter } from 'expo-router';
import { ClueDisplay } from '../components/game/ClueDisplay';
import { useRoom } from '~/hooks/socket';
import { Square, SquareType } from "~/hooks/useRoom";
import { LoadingGame } from '~/components/game/LoadingGame';
import { GameTimer } from '~/components/game/GameTimer';
import { useUser } from '~/hooks/users';
import { Avatar } from '~/components/shared/Avatar';
import ConnectionStatus from '~/components/ConnectionStatus';
import { CluesButton } from '../components/game/CluesButton';

export const GameScreen: React.FC<{ roomId: number }> = ({ roomId }) => {
    const { room, guess, refresh, forfeit } = useRoom(roomId);
    const { data: currentUser } = useUser();
    const router = useRouter();
    const [selectedCell, setSelectedCell] = useState<Square | null>(null);
    const [isAcrossMode, setIsAcrossMode] = useState(true);

    useEffect(() => {
        refresh(roomId);
    }, []);

    useEffect(() => {
        if (room?.board) {
            // Find the first valid cell in the board
            for (let x = 0; x < room.board.length; x++) {
                for (let y = 0; y < room.board[x].length; y++) {
                    const cell = room.board[x][y];
                    if (cell.squareType !== SquareType.BLACK && cell.squareType !== SquareType.SOLVED) {
                        setSelectedCell(cell);
                        return;
                    }
                }
            }
        }
    }, []);

    // Format clues and firstCellsMap for the CluesModal
    const formattedClues = useMemo(() => {
        const cellsMap: {
            across: Square[];
            down: Square[];
        } = {
            across: [],
            down: []
        };

        // Create sets to track unique clues
        const seenAcrossClues = new Set<string>();
        const seenDownClues = new Set<string>();

        room?.board.forEach((row, x) => {
            row.forEach((square, y) => {
                if (square.gridnumber) {
                    if (square.acrossQuestion && !seenAcrossClues.has(square.acrossQuestion)) {
                        seenAcrossClues.add(square.acrossQuestion);
                        cellsMap.across.push(square);
                    }
                    if (square.downQuestion && !seenDownClues.has(square.downQuestion)) {
                        seenDownClues.add(square.downQuestion);
                        cellsMap.down.push(square);
                    }
                }
            });
        });

        // Sort both arrays by gridnumber
        cellsMap.across.sort((a, b) => (a.gridnumber || 0) - (b.gridnumber || 0));
        cellsMap.down.sort((a, b) => (a.gridnumber || 0) - (b.gridnumber || 0));

        return cellsMap;
    }, [room?.board]);

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
        if (!room?.board) {
            return null;
        }

        const board = room.board;
        const { x, y } = currentCell;

        if (isAcrossMode) {
            // Move right
            for (let newY = y + 1; newY < board[x].length; newY++) {
                if (board[x][newY].squareType !== SquareType.BLACK && board[x][newY].squareType !== SquareType.SOLVED) {
                    return board[x][newY];
                }
            }
            // Move to next row
            for (let newX = x + 1; newX < board.length; newX++) {
                for (let newY = 0; newY < board[newX].length; newY++) {
                    if (board[newX][newY].squareType !== SquareType.BLACK && board[newX][newY].squareType !== SquareType.SOLVED) {
                        return board[newX][newY];
                    }
                }
            }
        } else {
            // Move down
            for (let newX = x + 1; newX < board.length; newX++) {
                if (board[newX][y].squareType !== SquareType.BLACK && board[newX][y].squareType !== SquareType.SOLVED) {
                    return board[newX][y];
                }
            }
            // Move to next column
            for (let newY = y + 1; newY < board[0].length; newY++) {
                for (let newX = 0; newX < board.length; newX++) {
                    if (board[newX][newY].squareType !== SquareType.BLACK && board[newX][newY].squareType !== SquareType.SOLVED) {
                        return board[newX][newY];
                    }
                }
            }
        }

        // If no next cell found, try to find any unsolved cell
        for (let newX = 0; newX < board.length; newX++) {
            for (let newY = 0; newY < board[newX].length; newY++) {
                if (board[newX][newY].squareType !== SquareType.BLACK && board[newX][newY].squareType !== SquareType.SOLVED) {
                    return board[newX][newY];
                }
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
            label: 'Forfeit Game',
            onPress: handleForfeit,
            style: { color: '#8B0000' }
        },
    ];

    return (
        <SafeAreaView className="flex-1 bg-[#F5F5EB] dark:bg-[#0F1417]">
            <View className="flex-row justify-between items-center px-4 mt-6">
                <View className="flex-row items-center gap-2">
                    {currentUser && (
                        <Avatar user={currentUser} imageUrl={currentUser.photo} size={32} />
                    )}
                    <Text className="text-sm text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                        {room.crossword.title}
                    </Text>
                </View>
                <ConnectionStatus compact />
                <GameTimer startTime={room.created_at} completedAt={room.completed_at} />
            </View>
            <PlayerInfo
                players={room.players}
                scores={room.scores}
            />
            <View className="flex-1 items-center">
                <View className="w-full">
                    <CrosswordBoard
                        board={room?.board}
                        onCellPress={handleCellPress}
                        selectedCell={selectedCell || null}
                        isAcrossMode={isAcrossMode}
                        setIsAcrossMode={setIsAcrossMode}
                        title={room.crossword.title}
                    />
                </View>
                <ClueDisplay
                    selectedSquare={selectedCell || null}
                    isAcrossMode={isAcrossMode}
                />
            </View>
            <View className="w-full absolute bottom-0 left-0 right-0 bg-[#F5F5EB] dark:bg-[#0F1417]">
                <Keyboard
                    onKeyPress={handleKeyPress}
                    disabledKeys={[]}
                />
            </View>
            <GameMenu options={menuOptions} />
            <CluesButton
                clues={formattedClues}
                onCluePress={(square, isAcrossMode) => {
                    setSelectedCell(square);
                    setIsAcrossMode(isAcrossMode);
                }}
            />
        </SafeAreaView>
    );
};
