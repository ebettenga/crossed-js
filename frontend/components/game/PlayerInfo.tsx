import React, { useEffect, useRef } from 'react';
import { View, Text, Dimensions, ScrollView } from 'react-native';
import { Player } from '~/hooks/useRoom';
import Animated, {
    useAnimatedStyle,
    withTiming,
    withSequence,
    useSharedValue,
} from 'react-native-reanimated';
import { useUser } from '~/hooks/users';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH / 2) - 12; // Half screen minus padding

interface PlayerInfoProps {
    players: Player[];
    scores: { [key: string]: number };
}

const ScoreChange: React.FC<{ value: number }> = ({ value }) => {
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
        translateX.value = withTiming(30, { duration: 1100 });
    }, [value]);

    if (value === 0) return null;

    return (
        <Animated.Text
            className={`absolute left-full ml-0.5 text-sm font-rubik-semibold ${value > 0 ? 'text-green-500' : 'text-red-600'}`}
            style={animatedStyle}
        >
            {value > 0 ? `+${value}` : value}
        </Animated.Text>
    );
};

export const PlayerInfo: React.FC<PlayerInfoProps> = ({ players, scores }) => {
    const prevScores = useRef<{ [key: string]: number }>({});
    const [scoreChanges, setScoreChanges] = React.useState<{ [key: string]: number }>({});
    const { data: currentUser } = useUser();

    useEffect(() => {
        // Calculate score changes
        const changes: { [key: string]: number } = {};
        players.forEach((player) => {
            const currentScore = scores[player.id] || 0;
            const previousScore = prevScores.current[player.id] || 0;
            const change = currentScore - previousScore;
            if (change !== 0) {
                changes[player.id] = change;
            }
        });

        // Update score changes if there are any
        if (Object.keys(changes).length > 0) {
            setScoreChanges(changes);
            // Clear changes after animation duration
            setTimeout(() => {
                setScoreChanges({});
            }, 1100);
        }

        // Update previous scores
        prevScores.current = scores;
    }, [scores, players]);

    // Sort players to put current user first
    const sortedPlayers = [...players].sort((a, b) => {
        if (a.id === currentUser?.id) return -1;
        if (b.id === currentUser?.id) return 1;
        return 0;
    });

    return (
        <View className="px-3 pt-3">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 2 }}
            >
                {sortedPlayers.map((player) => (
                    <View
                        key={player.id}
                        style={{ width: CARD_WIDTH }}
                        className={`p-3 rounded-lg flex-row items-center justify-between ${player.id === currentUser?.id
                            ? 'bg-[#8B0000]'
                            : 'bg-[#F5F5EB] dark:bg-[#1A2227]'
                            }`}
                    >
                        <View className="flex-row items-center gap-2">
                            <Text
                                className={`text-sm font-rubik-semibold ${player.id === currentUser?.id
                                    ? 'text-white'
                                    : 'text-[#1D2124] dark:text-[#DDE1E5]'
                                    }`}
                            >
                                {player.username}
                            </Text>
                        </View>
                        <View className="flex-row items-center relative">
                            <Text
                                className={`text-lg font-rubik-semibold ${player.id === currentUser?.id
                                    ? 'text-white'
                                    : 'text-[#1D2124] dark:text-[#DDE1E5]'
                                    }`}
                            >
                                {scores[player.id] || 0}
                            </Text>
                            <ScoreChange value={scoreChanges[player.id] || 0} />
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};
