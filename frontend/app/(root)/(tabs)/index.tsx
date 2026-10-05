import React, { useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { Users, Timer, Swords } from 'lucide-react-native';
import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { PageHeader } from '~/components/Header';
import { SocialSquare } from '~/components/home/SocialSquare';
import { GameBanner } from '~/components/home/GameBanner';
import { DifficultyDialog } from '~/components/home/DifficultyDialog';
import { useJoinRoom, Room } from '~/hooks/useJoinRoom';
import { Link } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useActiveRooms, usePendingRooms } from '~/hooks/useActiveRooms';
import { useUser } from '~/hooks/users';
import { cn } from '~/lib/utils';
import { useSound } from "~/hooks/useSound";
import { pencilSounds, randomPencilKey } from '~/assets/sounds/randomButtonSound';
import { useSoundPreference } from '~/hooks/useSoundPreference';
import { useLogger } from '~/hooks/useLogs';
import { useCancellationStore } from '~/hooks/useCancellationStore';
import Toast from 'react-native-toast-message';
import { useRoomEvents } from '~/hooks/socket';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 6;
const GAP = 3;
const SQUARES_PER_ROW = 2;
const BUTTON_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (GAP * (SQUARES_PER_ROW - 1))) / SQUARES_PER_ROW;

type GameMode = '1v1' | '2v2' | 'free4all' | 'time_trial';

export default function Home() {
    const { mutate: join, isPending: isJoining } = useJoinRoom();
    const joinInFlightRef = useRef(false);
    const { navigateToGame } = useRoomEvents();
    const logger = useLogger()
    const { data: activeRooms, isLoading: isLoadingRooms, refetch: refetchActiveRooms } = useActiveRooms();
    const { data: pendingRooms, isLoading: isLoadingPendingRooms, refetch: refetchPendingRooms } = usePendingRooms();
    const { data: user, isLoading: isLoadingUser, refetch: refetchUser } = useUser();
    const [refreshing, setRefreshing] = useState(false);


    const [isDifficultyDialogVisible, setDifficultyDialogVisible] = useState(false);
    const [selectedGameMode, setSelectedGameMode] = React.useState<GameMode | null>(null);
    const { isSoundEnabled } = useSoundPreference();
    const { play } = useSound(pencilSounds, { enabled: isSoundEnabled });
    const { state: cancellationState, completeCancellation } = useCancellationStore();

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

    const handleDifficultySelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
        setDifficultyDialogVisible(false);
        if (!selectedGameMode) return;
        // Ref guards double taps that land before isPending re-renders
        if (joinInFlightRef.current) return;
        joinInFlightRef.current = true;

        const mode = selectedGameMode;
        setSelectedGameMode(null);

        try {
            await play(randomPencilKey());
        } catch { }

        join({
            difficulty,
            type: mode
        }, {
            onSuccess: (room) => {
                // Multiplayer rooms navigate on game_started; time trials and
                // already-full rooms are playable right away
                if (mode === 'time_trial' || room.status === 'playing') {
                    navigateToGame(room.id);
                }
            },
            onError: () => {
                Toast.show({
                    text1: 'Could not join a game. Please try again.',
                    type: 'error'
                });
            },
            onSettled: () => {
                joinInFlightRef.current = false;
                refreshRooms();
            }
        });
    };

    const handleDialogClose = () => {
        setDifficultyDialogVisible(false);
        setSelectedGameMode(null);
    };



    const activeRoomsArray = activeRooms as Room[] || [];
    const pendingRoomsArray = pendingRooms as Room[] || [];
    const visiblePendingRooms = pendingRoomsArray.filter(
        (room) => room.join_type !== 'challenge'
    );
    const userId = user?.id;
    const activeRoomForUser = activeRoomsArray.find((room) =>
        room.players.some((player) => player.id === userId)
    );
    const pendingRoomForUser = pendingRoomsArray.find((room) =>
        room.players.some((player) => player.id === userId)
    );
    const hasActiveGame = Boolean(activeRoomForUser);
    const hasPendingGame = Boolean(pendingRoomForUser);
    const isSchedulingBlocked = hasActiveGame || hasPendingGame;
    const isCancellationBlockingNavigation =
        cancellationState.cancelledRoomId !== null &&
        cancellationState.stage !== "idle" &&
        activeRoomForUser?.id === cancellationState.cancelledRoomId;

    const handleGameModePress = React.useCallback((mode: GameMode) => {
        if (hasActiveGame || hasPendingGame) {
            const message = hasActiveGame
                ? 'You already have a game in progress.'
                : 'Finish your pending game before starting a new one.';
            Toast.show({
                text1: message,
                type: 'info'
            });

            if (hasActiveGame && activeRoomForUser && !isCancellationBlockingNavigation) {
                navigateToGame(activeRoomForUser.id);
            }
            return;
        }

        if (isJoining || joinInFlightRef.current) return;

        setSelectedGameMode(mode);
        setDifficultyDialogVisible(true);
    }, [activeRoomForUser, hasActiveGame, hasPendingGame, isCancellationBlockingNavigation, navigateToGame, isJoining]);

    const refreshRooms = React.useCallback(() => {
        refetchActiveRooms();
        refetchPendingRooms();
    }, [refetchActiveRooms, refetchPendingRooms]);

    useFocusEffect(React.useCallback(() => {
        refreshRooms();

        if (
            hasActiveGame &&
            activeRoomForUser &&
            activeRoomForUser.status === 'playing' &&
            !isCancellationBlockingNavigation
        ) {
            navigateToGame(activeRoomForUser.id);
        }

        if (
            cancellationState.cancelledRoomId !== null &&
            !hasActiveGame
        ) {
            completeCancellation(cancellationState.cancelledRoomId);
        }

        const intervalId = setInterval(() => {
            refreshRooms();
        }, 5000);

        return () => {
            clearInterval(intervalId);
        };
    }, [
        activeRoomForUser,
        hasActiveGame,
        refreshRooms,
        navigateToGame,
        isCancellationBlockingNavigation,
        cancellationState.cancelledRoomId,
        completeCancellation,
    ]));


    // Show loading state while any data is loading
    const isLoading = isLoadingUser || isLoadingRooms || isLoadingPendingRooms;
    if (isLoading || !user) {
        return (
            <View className="flex-1 justify-center items-center bg-[#F6FAFE] dark:bg-[#0F1417]">
                <ActivityIndicator size="large" color="#8B0000" />
            </View>
        );
    }

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

                    {visiblePendingRooms.length > 0 && (
                        <View className="w-full h-[80px]">
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={visiblePendingRooms.length > 10}
                                className="flex-1"
                            >
                                {visiblePendingRooms.map((pendingRoom) => (
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
                            customStyle={{
                                container: isSchedulingBlocked ? 'opacity-50' : undefined
                            }}
                        />
                        <HomeSquareButton
                            name="Time Trial"
                            icon={<Timer size={24} />}
                            onPress={() => handleGameModePress('time_trial')}
                            size={BUTTON_SIZE}
                            customStyle={{
                                container: isSchedulingBlocked ? 'opacity-50' : undefined
                            }}
                        />
                        <HomeSquareButton
                            name="Free for All"
                            icon={<Swords size={24} />}
                            onPress={() => handleGameModePress('free4all')}
                            size={BUTTON_SIZE}
                            customStyle={{
                                container: isSchedulingBlocked ? 'opacity-50' : undefined
                            }}
                        />
                        <SocialSquare size={BUTTON_SIZE} />
                    </View>
                </ScrollView>
            </View>
            <DifficultyDialog
                isVisible={isDifficultyDialogVisible}
                onClose={handleDialogClose}
                onSelect={handleDifficultySelect}
            />
        </View>
    );
}
