import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { CrosswordCell } from './CrosswordCell';
import { Square } from '~/hooks/useRoom';
import { config } from '~/config/config';
import { cn } from '~/lib/utils';
import { useUser } from '~/hooks/users';

const GRID_SIZE = config.game.crossword.gridSize;
const BORDER_WIDTH = config.game.crossword.borderWidth;

interface CrosswordBoardProps {
    board: Square[][];
    onCellPress: (square: Square) => void;
    selectedCell?: Square | null;
    isAcrossMode: boolean;
    setIsAcrossMode: (isAcross: boolean) => void;
    title: string;
    revealedLetterIndex?: number;
    scoreChanges: { [key: string]: number };
    lastGuessCell?: { x: number; y: number; playerId: string } | null;
    maxBoardSize?: number;
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
    board,
    onCellPress,
    selectedCell,
    isAcrossMode,
    setIsAcrossMode,
    title,
    revealedLetterIndex,
    scoreChanges,
    lastGuessCell,
    maxBoardSize,
}) => {
    const { data: currentUser } = useUser();
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize((prev) => {
            if (prev.width === width && prev.height === height) {
                return prev;
            }
            return { width, height };
        });
    }, []);

    const metrics = useMemo(() => {
        if (containerSize.width <= 0) {
            return null;
        }

        const availableWidth = containerSize.width - BORDER_WIDTH * 2;
        const heightLimit = typeof maxBoardSize === 'number'
            ? Math.max(maxBoardSize - BORDER_WIDTH * 2, 0)
            : availableWidth;
        const limitingDimension = Math.min(availableWidth, heightLimit);
        const cellSize = Math.floor(limitingDimension / GRID_SIZE);

        if (cellSize <= 0) {
            return null;
        }

        const boardSize = cellSize * GRID_SIZE + BORDER_WIDTH * 2;
        return { cellSize, boardSize };
    }, [containerSize.width, maxBoardSize]);

    const handleCellPress = (square: Square) => {
        if (selectedCell?.id === square.id) {
            setIsAcrossMode(!isAcrossMode);
        }
        onCellPress(square);
    };

    // Memoize the board rendering to prevent unnecessary re-renders
    const boardContent = useMemo(() => {
        if (!metrics) {
            return null;
        }

        const { cellSize } = metrics;

        return board.map((row, x) => (
            <View key={x} className="flex-row">
                {row.map((square, y) => {
                    const isSelected = selectedCell?.id === square.id;
                    const cellIndex = x * board[0].length + y;
                    const isRevealed = cellIndex === revealedLetterIndex;

                    const isLastGuessCell = lastGuessCell?.x === x && lastGuessCell?.y === y;
                    const scoreChange = isLastGuessCell ? scoreChanges[lastGuessCell.playerId] : 0;
                    const isCurrentUserGuess = isLastGuessCell && lastGuessCell.playerId === currentUser?.id;

                    return (
                        <CrosswordCell
                            key={`${x}-${y}`}
                            letter={square.letter || ''}
                            onPress={() => handleCellPress(square)}
                            coordinates={{ x, y }}
                            cellSize={cellSize}
                            isSelected={isSelected}
                            gridNumber={square.gridnumber}
                            squareType={square.squareType}
                            isAcrossMode={isAcrossMode}
                            isRevealed={isRevealed}
                            scoreChange={scoreChange}
                            isCurrentUserGuess={isCurrentUserGuess}
                        />
                    );
                })}
            </View>
        ));
    }, [
        board,
        metrics,
        selectedCell,
        onCellPress,
        isAcrossMode,
        revealedLetterIndex,
        scoreChanges,
        lastGuessCell,
        currentUser?.id,
    ]);

    return (
        <View
            onLayout={handleLayout}
            className={cn("w-full items-center pt-2")}
            style={{
                ...(typeof maxBoardSize === 'number' ? { maxHeight: maxBoardSize } : {}),
            }}
        >
            {metrics && (
                <View
                    className="items-center justify-center"
                    style={{ width: metrics.boardSize, height: metrics.boardSize }}
                >
                    <View
                        className={cn(
                            "bg-white dark:bg-neutral-800 rounded-lg overflow-hidden",
                            "border border-neutral-200 dark:border-neutral-700"
                        )}
                        style={{ width: metrics.boardSize, height: metrics.boardSize }}
                    >
                        {boardContent}
                    </View>
                </View>
            )}
        </View>
    );
};
