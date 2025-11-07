import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking, KeyboardAvoidingView, Platform, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CrosswordBoard } from '../components/game/CrosswordBoard';
import { Keyboard } from '../components/game/Keyboard';
import { PlayerInfo } from '../components/game/PlayerInfo';
import { GameMenu } from '../components/game/GameMenu';
import { useRouter } from 'expo-router';
import { ClueDisplay } from '../components/game/ClueDisplay';
import { useRoom } from '~/hooks/socket';
import { Square, SquareType, Room } from "~/hooks/useJoinRoom";
import { LoadingGame } from '~/components/game/LoadingGame';
import { useUser } from '~/hooks/users';
import { Avatar } from '~/components/shared/Avatar';
import ConnectionStatus from '~/components/ConnectionStatus';
import { CluesButton } from '../components/game/CluesButton';
import { SupportModal } from '../components/game/SupportModal';
import { GameSummaryModal } from '../components/game/GameSummaryModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showToast } from '~/components/shared/Toast';


type MenuOption = {
    label: string;
    onPress: () => void;
    style?: { color: string };
};

const CLUE_DISPLAY_HEIGHT = 70;

export const GameScreen: React.FC<{ roomId: number }> = ({ roomId }) => {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const { room: liveRoom, guess, refresh, forfeit, showGameSummary, onGameSummaryClose, revealedLetterIndex, isConnected } = useRoom(roomId);
    const { data: currentUser } = useUser();
    const router = useRouter();
    const [selectedCell, setSelectedCell] = useState<Square | null>(null);
    const [isAcrossMode, setIsAcrossMode] = useState(true);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [scoreChanges, setScoreChanges] = useState<{ [key: string]: number }>({});
    const [lastGuessCell, setLastGuessCell] = useState<{ x: number; y: number; playerId: string } | null>(null);
    const prevScores = useRef<{ [key: string]: number }>({});
    const refreshCooldownRef = useRef<NodeJS.Timeout | null>(null);
    const refreshPendingRef = useRef(false);
    const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasFallbackTriggeredRef = useRef(false);
    const [topSectionHeight, setTopSectionHeight] = useState(0);
    const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
    const [stableRoom, setStableRoom] = useState<Room | null>(null);

    useEffect(() => {
        if (liveRoom) {
            setStableRoom(liveRoom);
        }
    }, [liveRoom]);

    const room = liveRoom ?? stableRoom;


    useEffect(() => {
        if (!room) return;

        if (room.status === 'pending') {
            showToast(
                'info',
                'Your game is waiting for more players.',
                'We will redirect you once the game begins.',
            );
            router.replace('/(root)/(tabs)');
        }
    }, [room?.status, router]);

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

    const lastInitializedRoomIdRef = useRef<number | null>(null);

    useEffect(() => {
        const board = room?.board;
        if (!board) {
            return;
        }

        const hasSelectionForRoom =
            selectedCell &&
            lastInitializedRoomIdRef.current === room?.id;

        if (hasSelectionForRoom) {
            return;
        }

        for (let x = 0; x < board.length; x++) {
            for (let y = 0; y < board[x].length; y++) {
                const cell = board[x][y];
                if (cell.squareType !== SquareType.BLACK && cell.squareType !== SquareType.SOLVED) {
                    setSelectedCell(cell);
                    lastInitializedRoomIdRef.current = room?.id ?? null;
                    return;
                }
            }
        }
    }, [room?.board, room?.id, selectedCell]);

    useEffect(() => {
        if (!roomId || !isConnected) {
            return;
        }

        if (room && room.id === roomId) {
            return;
        }

        if (refreshPendingRef.current) {
            return;
        }

        refreshPendingRef.current = true;
        refresh(roomId);

        if (refreshCooldownRef.current) {
            clearTimeout(refreshCooldownRef.current);
        }

        refreshCooldownRef.current = setTimeout(() => {
            refreshPendingRef.current = false;
            refreshCooldownRef.current = null;
        }, 2000);
    }, [room, roomId, isConnected, refresh]);

    useEffect(() => {
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }

        if (!roomId) {
            return;
        }

        if (room && room.id === roomId) {
            hasFallbackTriggeredRef.current = false;
            return;
        }

        if (hasFallbackTriggeredRef.current) {
            return;
        }

        fallbackTimeoutRef.current = setTimeout(() => {
            hasFallbackTriggeredRef.current = true;
            showToast(
                'error',
                'We had trouble loading your game.',
                'Sending you home to try again.'
            );
            router.replace('/(root)/(tabs)');
        }, 10000);

        return () => {
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
                fallbackTimeoutRef.current = null;
            }
        };
    }, [room, roomId, router]);

    useEffect(() => {
        return () => {
            if (refreshCooldownRef.current) {
                clearTimeout(refreshCooldownRef.current);
            }
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
            }
            refreshPendingRef.current = false;
            hasFallbackTriggeredRef.current = false;
        };
    }, []);


    /*
This useEffect is to move the cursor for the player if the letter gets filled in by someone else / the job

TODO: figure out why there's a error happening with this hook not getting loaded
*/
    // useEffect(() => {
    //     if (!room?.board || !selectedCell) {
    //         return;
    //     }

    //     if (room.type == 'time_trial') {
    //         return;
    //     }

    //     const updatedCell = room.board[selectedCell.x]?.[selectedCell.y];
    //     if (!updatedCell) {
    //         return;
    //     }

    //     const wasSolved = selectedCell.squareType === SquareType.SOLVED;
    //     const isNowSolved = updatedCell.squareType === SquareType.SOLVED;

    //     if (!wasSolved && isNowSolved) {
    //         const next =
    //             findNextEditableCellInWord(updatedCell, room.board, isAcrossMode) ??
    //             findNextClueTarget(updatedCell, room.board, isAcrossMode, 'next');
    //         if (next) {
    //             setSelectedCell(next);
    //             return;
    //         }
    //     }

    //     if (selectedCell !== updatedCell) {
    //         setSelectedCell(updatedCell);
    //     }
    // }, [room?.board, selectedCell, isAcrossMode]);


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

        room?.board?.forEach((row, x) => {
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


    const handleCellPress = (coordinates: Square) => {
        setSelectedCell(coordinates);
    };

    const handleKeyPress = (key: string) => {
        if (!selectedCell || !room?.board) {
            return;
        }
        guess(roomId, { x: selectedCell.x, y: selectedCell.y }, key);
        setLastGuessCell({ x: selectedCell.x, y: selectedCell.y, playerId: String(currentUser?.id ?? "") });
        // Prefer next editable cell in the current word, otherwise follow clue navigation rules
        const inWordNext = findNextEditableCellInWord(selectedCell, room.board, isAcrossMode);
        const nextCell = inWordNext ?? findNextClueTarget(selectedCell, room.board, isAcrossMode, 'next');
        if (nextCell) {
            setSelectedCell(nextCell);
        }
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

    const findNextEditableCellInWord = (currentCell: Square, board: Square[][], across: boolean): Square | null => {
        const wordStart = getWordStart(currentCell, board, across);
        const wordCells = getWordCells(wordStart, board, across);
        const currentIndex = wordCells.findIndex(cell => cell.x === currentCell.x && cell.y === currentCell.y);

        for (let i = currentIndex + 1; i < wordCells.length; i++) {
            const cell = wordCells[i];
            if (cell.squareType !== SquareType.BLACK && cell.squareType !== SquareType.SOLVED) {
                return cell;
            }
        }

        return null;
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

    const findNextClueTarget = (
        currentCell: Square,
        board: Square[][],
        across: boolean,
        direction: 'next' | 'previous'
    ): Square | null => {
        const starts = buildClueStartList(board, across);
        if (starts.length === 0) {
            return null;
        }

        const currentStart = getWordStart(currentCell, board, across);
        const currentIndex = starts.findIndex(s => s.x === currentStart.x && s.y === currentStart.y);
        const step = direction === 'next' ? 1 : -1;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;

        let idx = (baseIndex + step + starts.length) % starts.length;
        let visited = 0;

        while (visited < starts.length) {
            const start = starts[idx];
            const wordCells = getWordCells(start, board, across);
            const firstUnsolved = wordCells.find(cell => cell.squareType !== SquareType.SOLVED);
            if (firstUnsolved) {
                return firstUnsolved;
            }
            idx = (idx + step + starts.length) % starts.length;
            visited++;
        }

        return null;
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
            label: 'Support / Report',
            onPress: () => {
                setShowSupportModal(true);
            },
        },
    ];
    if (room?.status !== 'finished') {
        menuOptions.push({
            label: 'Forfeit Game',
            onPress: handleForfeit,
            style: { color: '#8B0000' }
        },);
    }

    const handleClueNavigation = (direction: 'next' | 'previous') => {
        if (!selectedCell || !room?.board) return;

        const board = room.board;
        const across = isAcrossMode;

        // Build an ordered list of ALL clue starts for the current direction
        const target = findNextClueTarget(selectedCell, board, across, direction);
        if (target) {
            setSelectedCell(target);
        }
    };

    const hasActiveClue = Boolean(
        selectedCell && (isAcrossMode ? selectedCell.acrossQuestion : selectedCell?.downQuestion)
    );

    const handleTopLayout = useCallback((event: LayoutChangeEvent) => {
        const measured = Math.round(event.nativeEvent.layout.height);
        setTopSectionHeight((prev) => (Math.abs(prev - measured) > 1 ? measured : prev));
    }, []);

    const handleBottomLayout = useCallback((event: LayoutChangeEvent) => {
        const measured = Math.round(event.nativeEvent.layout.height);
        setBottomSectionHeight((prev) => (Math.abs(prev - measured) > 1 ? measured : prev));
    }, []);

    const availableBoardHeight = Math.max(
        0,
        windowHeight - insets.top - insets.bottom - topSectionHeight - bottomSectionHeight
    );

    if (!room || room.id !== roomId) {
        return <LoadingGame />;
    }

    return (
        <KeyboardAvoidingView
            style={{
                flex: 1,
                paddingLeft: insets.left,
                paddingRight: insets.right,
            }}
            className="bg-[#F6FAFE] dark:bg-[#0F1417]"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View className="flex-1">
                <View onLayout={handleTopLayout}>
                    <View className="flex-row justify-between items-center px-4 pt-2 pb-1">
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
                </View>
                <View
                    className="flex-1 px-2"
                    style={{ minHeight: 0 }}
                >
                    <View
                        className="flex-1 items-center justify-start"
                        style={{
                            minHeight: 0,
                            ...(availableBoardHeight > 0 ? { maxHeight: availableBoardHeight } : {}),
                        }}
                    >
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
                            maxBoardSize={availableBoardHeight > 0 ? availableBoardHeight : undefined}
                        />
                    </View>
                </View>
                <View
                    className="w-full bg-[#F5F5EB] dark:bg-[#0F1417]"
                    onLayout={handleBottomLayout}
                >
                    <View
                        style={{ height: CLUE_DISPLAY_HEIGHT }}
                        className="justify-center px-4"
                    >
                        {hasActiveClue ? (
                            <ClueDisplay
                                selectedSquare={selectedCell || null}
                                isAcrossMode={isAcrossMode}
                                onNavigate={handleClueNavigation}
                            />
                        ) : (
                            <View className="flex-1 items-center justify-center">
                                <Text className="text-sm text-[#666666] dark:text-[#9CA3AF]">
                                    Select a cell to view its clue
                                </Text>
                            </View>
                        )}
                    </View>
                    <View className="flex-row items-end justify-between bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 px-4 pt-2 pb-2 gap-4 shadow-lg">
                        <CluesButton
                            clues={formattedClues}
                            onCluePress={(square, isAcrossMode) => {
                                setSelectedCell(square);
                                setIsAcrossMode(isAcrossMode);
                            }}
                        />
                        <View className="flex-1">
                            <Keyboard
                                onKeyPress={handleKeyPress}
                                disabledKeys={[]}
                            />
                        </View>
                        <GameMenu options={menuOptions} />
                    </View>
                </View>
            </View>
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
