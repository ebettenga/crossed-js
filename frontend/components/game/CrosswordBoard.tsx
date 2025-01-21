import React, { useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import { CrosswordCell } from './CrosswordCell';
import { Square } from '~/hooks/useRoom';
import { config } from '~/config/config';
import { cn } from '~/lib/utils';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const GRID_SIZE = config.game.crossword.gridSize;
const BORDER_WIDTH = config.game.crossword.borderWidth;
const KEYBOARD_HEIGHT = 250;
const HEADER_HEIGHT = 120;

// Calculate board size
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - KEYBOARD_HEIGHT - HEADER_HEIGHT;
const AVAILABLE_WIDTH = SCREEN_WIDTH - (BORDER_WIDTH * 2);
const CELL_SIZE = Math.floor(Math.min(
    AVAILABLE_WIDTH / GRID_SIZE,
    AVAILABLE_HEIGHT / GRID_SIZE
));
const BOARD_SIZE = CELL_SIZE * GRID_SIZE + (BORDER_WIDTH * 2);

interface CrosswordBoardProps {
    board: Square[][];
    onCellPress: (square: Square) => void;
    selectedCell?: Square | null;
    isAcrossMode: boolean;
    setIsAcrossMode: (isAcross: boolean) => void;
    title: string;
    revealedLetterIndex?: number;
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
    board,
    onCellPress,
    selectedCell,
    isAcrossMode,
    setIsAcrossMode,
    title,
    revealedLetterIndex
}) => {
    const handleCellPress = (square: Square) => {
        if (selectedCell?.id === square.id) {
            setIsAcrossMode(!isAcrossMode);
        }
        onCellPress(square);
    };

    // Memoize the board rendering to prevent unnecessary re-renders
    const boardContent = useMemo(() => {
        return board.map((row, x) => (
            <View key={x} className="flex-row">
                {row.map((square, y) => {
                    const isSelected = selectedCell?.id === square.id;
                    const cellIndex = x * board[0].length + y;
                    const isRevealed = cellIndex === revealedLetterIndex;

                    return (
                        <CrosswordCell
                            key={`${x}-${y}`}
                            letter={square.letter || ''}
                            onPress={() => handleCellPress(square)}
                            coordinates={{ x, y }}
                            isSelected={isSelected}
                            gridNumber={square.gridnumber}
                            squareType={square.squareType}
                            isAcrossMode={isAcrossMode}
                            isRevealed={isRevealed}
                        />
                    );
                })}
            </View>
        ));
    }, [board, selectedCell, onCellPress, isAcrossMode, revealedLetterIndex]);

    return (
        <View className={cn(
            "w-full justify-center items-center pt-5",
            `h-[${AVAILABLE_HEIGHT}px]`
        )}>
            <View className="items-center justify-center" style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
                <View className={cn(
                    "bg-white dark:bg-neutral-800 rounded-lg overflow-hidden",
                    "border border-neutral-200 dark:border-neutral-700"
                )} style={{ width: BOARD_SIZE, height: BOARD_SIZE }}>
                    {boardContent}
                </View>
            </View>
        </View>
    );
};
