import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Users, Swords, Group } from 'lucide-react-native';
import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { HomeHeader } from '~/components/home/HomeHeader';
import { SocialSquare } from '~/components/home/SocialSquare';
import { GameBanner } from '~/components/home/GameBanner';
import { DifficultyBottomSheet } from '~/components/game/DifficultyBottomSheet';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useJoinRoom } from '~/hooks/useRoom';
import { useRoom } from '~/hooks/socket';
import { Link } from 'expo-router';
import { useActiveRooms, usePendingRooms } from '~/hooks/useActiveRooms';
import { useUser } from '~/hooks/users';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 6;
const GAP = 3;
const SQUARES_PER_ROW = 2;
const BUTTON_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (GAP * (SQUARES_PER_ROW - 1))) / SQUARES_PER_ROW;

type GameMode = '1v1' | '2v2' | 'free4all';

export default function Home() {
    const insets = useSafeAreaInsets();
    const { room } = useRoom();
    const { mutate: join } = useJoinRoom();
    const { data: activeRooms, isLoading: isLoadingRooms, error: activeRoomsError } = useActiveRooms();
    const { data: pendingRooms, isLoading: isLoadingPendingRooms, error: pendingRoomsError } = usePendingRooms();
    console.log(activeRooms);
    const { data: user, isLoading: isLoadingUser } = useUser();

    const isBottomSheetOpen = useSharedValue(false);
    const [selectedGameMode, setSelectedGameMode] = React.useState<GameMode | null>(null);

    const handleGameModePress = (mode: GameMode) => {
        setSelectedGameMode(mode);
        isBottomSheetOpen.value = true;
    };

    const handleDifficultySelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
        isBottomSheetOpen.value = false;
        if (!selectedGameMode) return;

        join({
            difficulty,
            type: selectedGameMode
        });
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
                    username={user?.username || "Loading..."}
                    elo={user?.eloRating || 0}
                    eloChange={25}
                    gamesPlayed={42}
                    avatarUrl="https://i.pravatar.cc/300"
                    coins={100}
                />
                {
                    activeRooms?.length && activeRooms?.length > 0 && (
                        <View style={styles.gameBannersScroll}>
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={Boolean(activeRooms?.length && activeRooms?.length > 10)}
                            >
                                {activeRooms?.map((activeRoom) => (
                                    <Link key={activeRoom.id} href={`/game?roomId=${activeRoom.id}`}>
                                        <View style={styles.bannerContainer}>
                                            <GameBanner
                                                gameId={activeRoom.id.toString()}
                                                gameType={activeRoom.type}
                                                createdAt={activeRoom.created_at}
                                                status="playing"
                                            />
                                        </View>
                                    </Link>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                {pendingRooms?.length && pendingRooms?.length > 0 && (
                    <View style={styles.gameBannersScroll}>
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={Boolean(pendingRooms.length > 10)}
                        >
                            {pendingRooms.map((pendingRoom) => (
                                <View style={styles.bannerContainer}>
                                    <GameBanner
                                        gameId={pendingRoom.id.toString()}
                                        gameType={pendingRoom.type}
                                        createdAt={pendingRoom.created_at}
                                        status="pending"
                                    />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
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

const BANNER_HEIGHT = 100;

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
    gameBannersScroll: {
        width: SCREEN_WIDTH,
        height: BANNER_HEIGHT,
    },
    bannerContainer: {
        width: SCREEN_WIDTH,
        height: BANNER_HEIGHT,
        paddingHorizontal: PADDING,
    },
});
