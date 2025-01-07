import React from 'react';
import { View, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Users, Swords, Group } from 'lucide-react-native';
import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { PageHeader } from '~/components/Header';
import { SocialSquare } from '~/components/home/SocialSquare';
import { GameBanner } from '~/components/home/GameBanner';
import { DifficultyBottomSheet } from '~/components/game/DifficultyBottomSheet';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useJoinRoom, Room } from '~/hooks/useRoom';
import { useRoom } from '~/hooks/socket';
import { Link } from 'expo-router';
import { useActiveRooms, usePendingRooms } from '~/hooks/useActiveRooms';
import { useUser } from '~/hooks/users';
import { cn } from '~/lib/utils';

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
    const { data: activeRooms, isLoading: isLoadingRooms } = useActiveRooms();
    const { data: pendingRooms, isLoading: isLoadingPendingRooms } = usePendingRooms();
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
                        name="2 v 2"
                        icon={<Group size={24} />}
                        onPress={() => handleGameModePress('2v2')}
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
            </View>
            <DifficultyBottomSheet
                isOpen={isBottomSheetOpen}
                onClose={handleBottomSheetClose}
                onSelect={handleDifficultySelect}
            />
        </View>
    );
}
