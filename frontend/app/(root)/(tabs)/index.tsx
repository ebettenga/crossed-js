import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { Users, Timer, Swords, Group } from 'lucide-react-native';
import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { PageHeader } from '~/components/Header';
import { SocialSquare } from '~/components/home/SocialSquare';
import { GameBanner } from '~/components/home/GameBanner';
import { DifficultyBottomSheet } from '~/components/game/DifficultyBottomSheet';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useJoinRoom, Room } from '~/hooks/useJoinRoom';
import { useRoom } from '~/hooks/socket';
import { Link, useRouter } from 'expo-router';
import { useActiveRooms, usePendingRooms } from '~/hooks/useActiveRooms';
import { useUser } from '~/hooks/users';
import { cn } from '~/lib/utils';
import { useAds } from '~/hooks/useAds';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 6;
const GAP = 3;
const SQUARES_PER_ROW = 2;
const BUTTON_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (GAP * (SQUARES_PER_ROW - 1))) / SQUARES_PER_ROW;

type GameMode = '1v1' | '2v2' | 'free4all' | 'time_trial';

export default function Home() {
    const router = useRouter();
    const hasActiveGame = useRef(false);
    const { mutate: join } = useJoinRoom();
    const { data: activeRooms, isLoading: isLoadingRooms, refetch: refetchActiveRooms } = useActiveRooms();
    const { data: pendingRooms, isLoading: isLoadingPendingRooms, refetch: refetchPendingRooms } = usePendingRooms();
    const { data: user, isLoading: isLoadingUser, refetch: refetchUser } = useUser();
    const [refreshing, setRefreshing] = useState(false);
    const { showInterstitial } = useAds();

    const isBottomSheetOpen = useSharedValue(false);
    const [selectedGameMode, setSelectedGameMode] = React.useState<GameMode | null>(null);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                refetchUser(),
                refetchActiveRooms(),
                refetchPendingRooms()
            ]);
        } catch (error) {
            console.error('Error refreshing:', error);
        }
        setRefreshing(false);
    }, [refetchUser, refetchActiveRooms, refetchPendingRooms]);

    const handleGameModePress = async (mode: GameMode) => {
        // Show interstitial ad before opening difficulty selection
        showInterstitial().then(() => {

            setSelectedGameMode(mode);
            isBottomSheetOpen.value = true;
        });
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

    // Show loading state while any data is loading
    const isLoading = isLoadingUser || isLoadingRooms || isLoadingPendingRooms;
    if (isLoading || !user) {
        return (
            <View className="flex-1 justify-center items-center bg-[#F6FAFE] dark:bg-[#0F1417]">
                <ActivityIndicator size="large" color="#8B0000" />
            </View>
        );
    }

    const activeRoomsArray = activeRooms as Room[] || [];
    const pendingRoomsArray = pendingRooms as Room[] || [];

    // Add this useEffect to check for active games and redirect

    useEffect(() => {
        if (user && activeRooms && !hasActiveGame.current) {
            // Find any active room where the current user is a player
            const userActiveRoom = activeRooms.find(room =>
                room.players.some(player => player.id === user.id)
            );

            if (userActiveRoom) {
                // Navigate to the game if found
                hasActiveGame.current = true;
                router.push(`/game?roomId=${userActiveRoom.id}`);
            }
        }
    }, [user, activeRooms, router]);

    return (
        <View
            className={cn(
                "flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]",
                "pt-[${insets.top}px] pb-[${insets.bottom}px]",
                "pl-[${insets.left}px] pr-[${insets.right}px]"
            )}
        >
            <View className="flex-1">
                <PageHeader />
                <ScrollView
                    className="flex-1"
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#8B0000"
                            colors={["#8B0000"]}
                        />
                    }
                >
                    {activeRoomsArray.length > 0 && (
                        <View className="w-full h-[80px]">
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={activeRoomsArray.length > 10}
                                className="flex-1"
                            >
                                {activeRoomsArray.map((activeRoom) => (
                                    <Link key={activeRoom.id} href={`/game?roomId=${activeRoom.id}`}>
                                        <View className="w-screen h-[100px] px-[6px]">
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

                    {pendingRoomsArray.length > 0 && (
                        <View className="w-full h-[80px]">
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={pendingRoomsArray.length > 10}
                                className="flex-1"
                            >
                                {pendingRoomsArray.map((pendingRoom) => (
                                    <View key={pendingRoom.id} className="w-screen h-[100px] px-[6px]">
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

                    <View className="p-[6px] flex-row flex-wrap gap-[3px] justify-start items-start mt-4">
                        <HomeSquareButton
                            name="1 v 1"
                            icon={<Users size={24} />}
                            onPress={() => handleGameModePress('1v1')}
                            number={1}
                            size={BUTTON_SIZE}
                        />
                        <HomeSquareButton
                            name="Time Trial"
                            icon={<Timer size={24} />}
                            onPress={() => handleGameModePress('time_trial')}
                            size={BUTTON_SIZE}
                        />
                        <HomeSquareButton
                            name="Free for All"
                            icon={<Swords size={24} />}
                            onPress={() => handleGameModePress('free4all')}
                            size={BUTTON_SIZE}
                        />
                        <SocialSquare size={BUTTON_SIZE} />
                    </View>
                </ScrollView>
            </View>
            <DifficultyBottomSheet
                isOpen={isBottomSheetOpen}
                onClose={handleBottomSheetClose}
                onSelect={handleDifficultySelect}
            />
        </View>
    );
}
