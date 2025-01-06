import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { CrosswordCell } from './CrosswordCell';
import { ScrollView } from 'react-native-gesture-handler';
import { Square } from '~/hooks/useRoom';
import { config } from '~/config/config';

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
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
    board,
    onCellPress,
    selectedCell,
    isAcrossMode,
    setIsAcrossMode,
    title
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
            <View key={x} style={styles.row}>
                {row.map((square, y) => {
                    const isSelected = selectedCell?.id === square.id;
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
                        />
                    );
                })}
            </View>
        ));
    }, [board, selectedCell, onCellPress, isAcrossMode]);

    return (
        <View style={styles.container}>
            <View style={styles.boardWrapper}>
                <View style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
                    {boardContent}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: AVAILABLE_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 20,
    },
    boardWrapper: {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    board: {
        backgroundColor: config.theme.colors.background.paper,
        borderRadius: 6,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
    },
});
