import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import { PlayerInfo } from '../components/game/PlayerInfo';
import { GameMenu } from '../components/game/GameMenu';
import { useRouter } from 'expo-router';
import { ClueDisplay } from '../components/game/ClueDisplay';
import { useRoom } from '~/hooks/socket';
import { Square, SquareType } from "~/hooks/useJoinRoom";
import { LoadingGame } from '~/components/game/LoadingGame';
import { useUser } from '~/hooks/users';
import { Avatar } from '~/components/shared/Avatar';
import ConnectionStatus from '~/components/ConnectionStatus';
import { CluesButton } from '../components/game/CluesButton';
import { SupportModal } from '../components/game/SupportModal';
import { GameSummaryModal } from '../components/game/GameSummaryModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


type MenuOption = {
    label: string;
    onPress: () => void;
    style?: { color: string };
};

export const GameScreen: React.FC<{ roomId: number }> = ({ roomId }) => {
    const insets = useSafeAreaInsets();
    const { room, guess, refresh, forfeit, showGameSummary, onGameSummaryClose, revealedLetterIndex } = useRoom(roomId);
    const { data: currentUser } = useUser();
    const router = useRouter();
    const [selectedCell, setSelectedCell] = useState<Square | null>(null);
    const [isAcrossMode, setIsAcrossMode] = useState(true);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [scoreChanges, setScoreChanges] = useState<{ [key: string]: number }>({});
    const [lastGuessCell, setLastGuessCell] = useState<{ x: number; y: number; playerId: string } | null>(null);
    const prevScores = useRef<{ [key: string]: number }>({});


    useEffect(() => {
        refresh(roomId);
    }, []);

    useEffect(() => {
        if (!room) return;

        const changes: { [key: string]: number } = {};
        room.players.forEach((player) => {
            const currentScore = room.scores[player.id] || 0;
            const previousScore = prevScores.current[player.id] || 0;
            const change = currentScore - previousScore;
            if (change !== 0) {
                changes[player.id] = change;
            }
        });

        if (Object.keys(changes).length > 0) {
            setScoreChanges(changes);
            setTimeout(() => {
                setScoreChanges({});
                setLastGuessCell(null);
            }, 1100);
        }

        prevScores.current = room.scores;
    }, [room?.scores]);

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
                        // Check if all squares in this across word are solved
                        let allSolved = true;
                        let currentY = y;
                        while (currentY < row.length && room.board[x][currentY].squareType !== SquareType.BLACK) {
                            if (room.board[x][currentY].squareType !== SquareType.SOLVED) {
                                allSolved = false;
                                break;
                            }
                            currentY++;
                        }

                        if (!allSolved) {
                            seenAcrossClues.add(square.acrossQuestion);
                            cellsMap.across.push(square);
                        }
                    }

                    // Check down clue
                    if (square.downQuestion && !seenDownClues.has(square.downQuestion)) {
                        // Check if all squares in this down word are solved
                        let allSolved = true;
                        let currentX = x;
                        while (currentX < room.board.length && room.board[currentX][y].squareType !== SquareType.BLACK) {
                            if (room.board[currentX][y].squareType !== SquareType.SOLVED) {
                                allSolved = false;
                                break;
                            }
                            currentX++;
                        }

                        if (!allSolved) {
                            seenDownClues.add(square.downQuestion);
                            cellsMap.down.push(square);
                        }
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
        setLastGuessCell({ x: selectedCell.x, y: selectedCell.y, playerId: String(currentUser?.id ?? "") });
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

    // Helpers for clue navigation to ensure deterministic sequencing by direction
    const isStartOfWord = (cell: Square, board: Square[][], across: boolean): boolean => {
        const { x, y } = cell;
        if (across) {
            if (!cell.acrossQuestion) return false;
            return y === 0 || board[x][y - 1].squareType === SquareType.BLACK;
        } else {
            if (!cell.downQuestion) return false;
            return x === 0 || board[x - 1][y].squareType === SquareType.BLACK;
        }
    };

    const getWordStart = (cell: Square, board: Square[][], across: boolean): Square => {
        let { x, y } = cell;
        if (across) {
            while (y > 0 && board[x][y - 1].squareType !== SquareType.BLACK) y--;
        } else {
            while (x > 0 && board[x - 1][y].squareType !== SquareType.BLACK) x--;
        }
        return board[x][y];
    };

    const getWordCells = (start: Square, board: Square[][], across: boolean): Square[] => {
        const cells: Square[] = [];
        const startX = start.x;
        const startY = start.y;
        if (across) {
            let yy = startY;
            while (yy < board[startX].length && board[startX][yy].squareType !== SquareType.BLACK) {
                cells.push(board[startX][yy]);
                yy++;
            }
        } else {
            let xx = startX;
            while (xx < board.length && board[xx][startY].squareType !== SquareType.BLACK) {
                cells.push(board[xx][startY]);
                xx++;
            }
        }
        return cells;
    };

    const buildClueStartList = (board: Square[][], across: boolean): Square[] => {
        const starts: Square[] = [];
        for (let x = 0; x < board.length; x++) {
            for (let y = 0; y < board[x].length; y++) {
                const cell = board[x][y];
                if (cell.squareType === SquareType.BLACK) continue;
                if (isStartOfWord(cell, board, across)) {
                    // Include all clue starts; we'll filter solved words during navigation
                    starts.push(cell);
                }
            }
        }
        starts.sort((a, b) => {
            const ag = a.gridnumber ?? Number.MAX_SAFE_INTEGER;
            const bg = b.gridnumber ?? Number.MAX_SAFE_INTEGER;
            if (ag !== bg) return ag - bg;
            return a.x === b.x ? a.y - b.y : a.x - b.x;
        });
        return starts;
    };

    const handleForfeit = () => {
        forfeit(roomId);
    };

    const handleReport = () => {
        setShowSupportModal(false);
        // TODO: Implement report functionality
        console.log('Report game:', roomId);
    };

    const menuOptions: MenuOption[] = [
        {
            label: 'Home',
            onPress: () => {
                router.push('/(root)/(tabs)');
            },
        },
        {
            label: 'Support / Report',
            onPress: () => {
                setShowSupportModal(true);
            },
        },
    ];
    if (room.status !== 'finished') {
        menuOptions.push({
            label: 'Forfeit Game',
            onPress: handleForfeit,
            style: { color: '#8B0000' }
        },);
    }

    if (room?.board && !selectedCell) {
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

    const handleClueNavigation = (direction: 'next' | 'previous') => {
        if (!selectedCell || !room?.board) return;

        const board = room.board;
        const across = isAcrossMode;

        // Build an ordered list of ALL clue starts for the current direction
        const starts = buildClueStartList(board, across);
        if (starts.length === 0) return;

        // Find the start of the currently selected clue (by walking to the beginning of the word)
        const currentStart = getWordStart(selectedCell, board, across);
        const currentIndex = starts.findIndex(s => s.x === currentStart.x && s.y === currentStart.y);

        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const step = direction === 'next' ? 1 : -1;

        // Iterate until we find a clue with an unsolved letter, wrapping as needed.
        let idx = (baseIndex + step + starts.length) % starts.length;
        let visited = 0;
        let target: Square | null = null;

        while (visited < starts.length) {
            const start = starts[idx];
            const wordCells = getWordCells(start, board, across);
            const firstUnsolved = wordCells.find(c => c.squareType !== SquareType.SOLVED);
            if (firstUnsolved) {
                target = firstUnsolved;
                break;
            }
            idx = (idx + step + starts.length) % starts.length;
            visited++;
        }

        // If all words are solved, keep current selection; otherwise move to the found unsolved letter
        if (target) {
            setSelectedCell(target);
        }
    };

    return (
        <KeyboardAvoidingView style={{
            flex: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
        }}
            className="bg-[#F6FAFE] dark:bg-[#0F1417]" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

            <View className="flex-row justify-between items-center px-4 mt-2">
                <View className="flex-row items-center gap-2">
                    {currentUser && (
                        <Avatar user={currentUser} imageUrl={currentUser.photo} size={32} />
                    )}
                </View>
                <View className="flex-row items-center gap-2">
                    {room.crossword.created_by && (
                        <View className="mt-1">
                            <Text className="text-xs text-[#666666] dark:text-[#9CA3AF]">
                                Created by{' '}
                            </Text>
                            <Text className="text-sm text-[#666666] dark:text-[#9CA3AF]">
                                {room.crossword.creator_link ? (
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(room.crossword.creator_link!)}
                                    >
                                        <Text className="text-[#8B0000] dark:text-[#FF6B6B] underline">
                                            {room.crossword.author}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text className="text-[#1D2124] dark:text-[#DDE1E5]">
                                        {room.crossword.author}
                                    </Text>
                                )}
                            </Text>
                        </View>
                    )}
                    <ConnectionStatus compact />
                </View>
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
                        revealedLetterIndex={revealedLetterIndex}
                        scoreChanges={scoreChanges}
                        lastGuessCell={lastGuessCell}
                    />
                </View>
                <ClueDisplay
                    selectedSquare={selectedCell || null}
                    isAcrossMode={isAcrossMode}
                    onNavigate={handleClueNavigation}
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
            <SupportModal
                isVisible={showSupportModal}
                onClose={() => setShowSupportModal(false)}
                onReport={handleReport}
            />

            {room && room.status === 'finished' && (
                <GameSummaryModal
                    isVisible={showGameSummary}
                    onClose={onGameSummaryClose}
                    room={room}
                />
            )}
        </KeyboardAvoidingView>
    );
};
