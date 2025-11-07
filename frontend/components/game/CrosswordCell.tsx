import React, { useEffect } from 'react';
import { StyleSheet, Pressable, View, Text } from 'react-native';
import { SquareType } from '~/hooks/useJoinRoom';
import { config } from '~/config/config';
import { ArrowRight, ArrowDown } from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    withTiming,
    withSequence,
    useSharedValue,
} from 'react-native-reanimated';

const GRID_SIZE = config.game.crossword.gridSize;
const BORDER_WIDTH = config.game.crossword.borderWidth;

const CORNER_RADIUS = config.game.crossword.cornerRadius;

// Colors from config
const PAPER_COLOR = "#F6FAFE"
const SELECTED_COLOR = config.theme.colors.primary.DEFAULT
const BORDER_COLOR = "#000000"
const REVEALED_COLOR = "#FFE4E1" // Misty Rose - a light red/pink color that will make text visible
const LETTER_VERTICAL_OFFSET_RATIO = 0.05;

interface CrosswordCellProps {
    letter: string;
    onPress: () => void;
    coordinates: { x: number; y: number };
    cellSize: number;
    isSelected?: boolean;
    gridNumber?: number | null;
    squareType: SquareType;
    isAcrossMode?: boolean;
    isRevealed?: boolean; // New prop for revealed letters
    scoreChange?: number;
    isCurrentUserGuess?: boolean;
}

const ScoreChange: React.FC<{ value: number; cellSize: number }> = ({ value, cellSize }) => {
    const opacity = useSharedValue(1);
    const translateX = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateX: translateX.value }],
    }));

    useEffect(() => {
        opacity.value = 1;
        translateX.value = 0;

        opacity.value = withSequence(
            withTiming(1, { duration: 100 }),
            withTiming(0, { duration: 1000 })
        );
        translateX.value = withTiming(-40, { duration: 1100 });
    }, [value]);

    if (value === 0) return null;

    return (
        <Animated.Text
            className={`absolute text-lg font-rubik-bold ${value > 0 ? 'text-green-500' : 'text-red-600'}`}
            style={[
                animatedStyle,
                {
                    transform: [
                        { translateX: -cellSize / 2 },
                        { translateY: -cellSize / 2 }
                    ],
                    zIndex: 10
                }
            ]}
        >
            {value > 0 ? `+${value}` : value}
        </Animated.Text>
    );
};

export const CrosswordCell: React.FC<CrosswordCellProps> = ({
    letter,
    onPress,
    coordinates,
    cellSize,
    isSelected = false,
    gridNumber,
    squareType,
    isAcrossMode = true,
    isRevealed = false,
    scoreChange = 0,
    isCurrentUserGuess = false,
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
                        width: cellSize,
                        height: cellSize,
                        borderTopWidth: BORDER_WIDTH,
                        borderLeftWidth: BORDER_WIDTH,
                        borderRightWidth: coordinates.y === GRID_SIZE - 1 ? BORDER_WIDTH : 0.5,
                        borderBottomWidth: coordinates.x === GRID_SIZE - 1 ? BORDER_WIDTH : 0.5,
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
                        {
                            color: getTextColor(),
                            fontSize: cellSize * 0.25,
                        }
                    ]}>
                        {gridNumber}
                    </Text>
                )}
                {!isBlackSquare && (
                    <Text style={[
                        styles.letter,
                        !isSolved && styles.hiddenText,
                        {
                            color: getTextColor(),
                            fontSize: cellSize * 0.5,
                            marginTop: cellSize * LETTER_VERTICAL_OFFSET_RATIO,
                        }
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
                {isCurrentUserGuess && scoreChange !== 0 && (
                    <ScoreChange value={scoreChange} cellSize={cellSize} />
                )}
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    cell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderColor: BORDER_COLOR,
    },
    selectedCell: {
        borderColor: BORDER_COLOR,
        borderWidth: BORDER_WIDTH,
    },
    letter: {
        fontWeight: '400',
        fontFamily: 'Rubik-Regular',
    },
    gridNumber: {
        position: 'absolute',
        top: 0,
        left: 2,
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
