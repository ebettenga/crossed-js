import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Swords, Group } from 'lucide-react-native';
import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { HomeHeader } from '~/components/home/HomeHeader';
import { SocialSquare } from '~/components/home/SocialSquare';
import { GameBanner } from '~/components/home/GameBanner';
import { DifficultyBottomSheet } from '~/components/game/DifficultyBottomSheet';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '~/hooks/storageApi';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 6;
const GAP = 3;
const SQUARES_PER_ROW = 2;
const BUTTON_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (GAP * (SQUARES_PER_ROW - 1))) / SQUARES_PER_ROW;

type GameMode = '1v1' | '2v2' | 'free4all';

export default function Home() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const hasActiveGame = true;
    const isBottomSheetOpen = useSharedValue(false);
    const [selectedGameMode, setSelectedGameMode] = React.useState<GameMode | null>(null);

    const handleGameModePress = (mode: GameMode) => {
        setSelectedGameMode(mode);
        isBottomSheetOpen.value = true;
    };

    const handleDifficultySelect = (difficulty: 'easy' | 'medium' | 'hard') => {
        isBottomSheetOpen.value = false;
        // if (selectedGameMode) {
        //     router.push({
        //         pathname: '/game',
        //         params: { 
        //             difficulty,
        //             mode: selectedGameMode
        //         }
        //     });
        // }
    };

    const handleBottomSheetClose = () => {
        isBottomSheetOpen.value = false;
        setSelectedGameMode(null);
    };

    return (
        <View style={[
            styles.container,
            {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                // Add horizontal safe area padding if needed
                paddingLeft: insets.left,
                paddingRight: insets.right,
            }
        ]}>
            <View style={styles.content}>
                <HomeHeader 
                    username="John Doe"
                    elo={1250}
                    eloChange={25}
                    gamesPlayed={42}
                    avatarUrl="https://i.pravatar.cc/300"
                    coins={100}
                />
                {hasActiveGame && (
                    <GameBanner 
                        gameId="123"
                        opponent="Jane Smith"
                    />
                )}
                <View style={styles.grid}>
                    <HomeSquareButton
                        name="1 v 1"
                        icon={<Users size={24} color="#2B2B2B" />}
                        onPress={() => handleGameModePress('1v1')}
                        number={1}
                        size={BUTTON_SIZE}
                    />
                    <HomeSquareButton
                        name="2 v 2"
                        icon={<Group size={24} color="#2B2B2B" />}
                        onPress={() => handleGameModePress('2v2')}
                        size={BUTTON_SIZE}
                    />
                    <HomeSquareButton
                        name="Free for All"
                        icon={<Swords size={24} color="#2B2B2B" />}
                        onPress={() => handleGameModePress('free4all')}
                        size={BUTTON_SIZE}
                    />
                    <SocialSquare size={BUTTON_SIZE} />
                </View>
            </View>

            <DifficultyBottomSheet
                isOpen={isBottomSheetOpen}
                onClose={handleBottomSheetClose}
                onSelect={handleDifficultySelect}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    content: {
        flex: 1,
    },
    grid: {
        padding: PADDING,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        marginTop: 16,
    },
});
