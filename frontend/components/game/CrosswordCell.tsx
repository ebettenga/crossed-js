import React from 'react';
import { StyleSheet, Dimensions, Pressable, View, Text } from 'react-native';
import { SquareType } from '~/hooks/useJoinRoom';
import { config } from '~/config/config';
import { ArrowRight, ArrowDown } from 'lucide-react-native';

// Calculate cell size based on screen width and height
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const GRID_SIZE = config.game.crossword.gridSize;
const BORDER_WIDTH = config.game.crossword.borderWidth;
const KEYBOARD_HEIGHT = 250; // Approximate height of keyboard + clue display
const HEADER_HEIGHT = 120; // Approximate height of header section

// Calculate the maximum available space for the board
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - KEYBOARD_HEIGHT - HEADER_HEIGHT;
const AVAILABLE_WIDTH = SCREEN_WIDTH - (BORDER_WIDTH * 2);

// Use the smaller of width or height to ensure square cells that fit the screen
const CELL_SIZE = Math.floor(Math.min(
    AVAILABLE_WIDTH / GRID_SIZE,
    AVAILABLE_HEIGHT / GRID_SIZE
));

const CORNER_RADIUS = config.game.crossword.cornerRadius;

// Colors from config
const PAPER_COLOR = "#F6FAFE"
const SELECTED_COLOR = config.theme.colors.primary.DEFAULT
const BORDER_COLOR = "#000000"
const REVEALED_COLOR = "#FFE4E1" // Misty Rose - a light red/pink color that will make text visible

interface CrosswordCellProps {
    letter: string;
    onPress: () => void;
    coordinates: { x: number; y: number };
    isSelected?: boolean;
    gridNumber?: number | null;
    squareType: SquareType;
    isAcrossMode?: boolean;
    isRevealed?: boolean; // New prop for revealed letters
}

export const CrosswordCell: React.FC<CrosswordCellProps> = ({
    letter,
    onPress,
    coordinates,
    isSelected = false,
    gridNumber,
    squareType,
    isAcrossMode = true,
    isRevealed = false,
}) => {
    // Determine if this cell is a corner
    const isTopLeft = coordinates.x === 0 && coordinates.y === 0;
    const isTopRight = coordinates.x === 0 && coordinates.y === GRID_SIZE - 1;
    const isBottomLeft = coordinates.x === GRID_SIZE - 1 && coordinates.y === 0;
    const isBottomRight = coordinates.x === GRID_SIZE - 1 && coordinates.y === GRID_SIZE - 1;

    const isBlackSquare = squareType === SquareType.BLACK;
    const isSolved = squareType === SquareType.SOLVED;

    // Disable press for black squares and solved squares
    const isDisabled = squareType === SquareType.BLACK || squareType === SquareType.SOLVED;

    // Determine background color based on state
    const getBackgroundColor = () => {
        if (isBlackSquare) return BORDER_COLOR;
        if (isSelected) return SELECTED_COLOR;
        if (isRevealed && isSolved) return REVEALED_COLOR;
        return PAPER_COLOR;
    };

    // Determine text color based on state
    const getTextColor = () => {
        if (isSelected && !isDisabled) return '#FFFFFF';
        if (isRevealed && isSolved) return SELECTED_COLOR; // Use primary color for revealed letters
        return BORDER_COLOR;
    };

    return (
        <Pressable onPress={isDisabled ? undefined : onPress}>
            <View
                style={[
                    styles.cell,
                    {
                        borderRightWidth: coordinates.y === GRID_SIZE - 1 ? BORDER_WIDTH : 0,
                        borderBottomWidth: coordinates.x === GRID_SIZE - 1 ? BORDER_WIDTH : 0,
                        backgroundColor: getBackgroundColor(),
                        borderTopLeftRadius: isTopLeft ? CORNER_RADIUS : 0,
                        borderTopRightRadius: isTopRight ? CORNER_RADIUS : 0,
                        borderBottomLeftRadius: isBottomLeft ? CORNER_RADIUS : 0,
                        borderBottomRightRadius: isBottomRight ? CORNER_RADIUS : 0,
                    },
                    isSelected && !isDisabled && styles.selectedCell,
                ]}
            >
                {gridNumber && gridNumber > 0 && (
                    <Text style={[
                        styles.gridNumber,
                        { color: getTextColor() }
                    ]}>
                        {gridNumber}
                    </Text>
                )}
                {!isBlackSquare && (
                    <Text style={[
                        styles.letter,
                        !isSolved && styles.hiddenText,
                        { color: getTextColor() }
                    ]}>
                        {letter}
                    </Text>
                )}
                {isSelected && !isDisabled && (
                    <View style={styles.directionIndicator}>
                        {isAcrossMode ? (
                            <ArrowRight size={12} color={"#FFFFFF"} />
                        ) : (
                            <ArrowDown size={12} color={"#FFFFFF"} />
                        )}
                    </View>
                )}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    cell: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopWidth: BORDER_WIDTH,
        borderLeftWidth: BORDER_WIDTH,
        borderColor: BORDER_COLOR,
    },
    selectedCell: {
        borderColor: BORDER_COLOR,
        borderWidth: BORDER_WIDTH,
    },
    letter: {
        fontSize: CELL_SIZE * 0.5,
        fontWeight: '600',
        fontFamily: 'Times New Roman',
    },
    gridNumber: {
        position: 'absolute',
        top: 0,
        left: 2,
        fontSize: CELL_SIZE * 0.25,
        fontWeight: '500',
    },
    hiddenText: {
        color: 'transparent',
    },
    directionIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
    },
});
