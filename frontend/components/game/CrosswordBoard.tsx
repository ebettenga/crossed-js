import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { CrosswordCell } from './CrosswordCell';
import Animated, {
    FadeIn,
    LinearTransition,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { Square } from '~/hooks/socket';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CrosswordBoardProps {
    board: Square[][];
    onCellPress: (square: Square) => void;
    selectedCell?: Square | null;
    isAcrossMode: boolean;
    setIsAcrossMode: (isAcross: boolean) => void;
}

export const CrosswordBoard: React.FC<CrosswordBoardProps> = ({
    board,
    onCellPress,
    selectedCell,
    isAcrossMode,
    setIsAcrossMode
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
            <Animated.View
                key={x}
                style={styles.row}
                entering={FadeIn.delay(x * 25).springify()}
                layout={LinearTransition.springify()}
            >
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
                        />
                    );
                })}
            </Animated.View>
        ));
    }, [board, selectedCell, onCellPress]);

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                contentContainerStyle={[styles.scrollContainer, { paddingTop: 2 }]}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
            >
                <ScrollView
                    contentContainerStyle={styles.boardContainer}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                >
                    <Animated.View layout={LinearTransition.springify()}>
                        {boardContent}
                    </Animated.View>
                </ScrollView>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
    },
    scrollContainer: {
        flexGrow: 1,
        minWidth: SCREEN_WIDTH,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    boardContainer: {
        padding: 5,
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
    },
}); 