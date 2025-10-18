import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight, Gamepad2, Clock, X } from 'lucide-react-native';
import { useRoom } from '~/hooks/socket';

interface GameBannerProps {
    gameId: string;
    gameType: string;
    createdAt: string;
    status?: 'pending' | 'playing' | 'finished' | 'cancelled';
}

export const GameBanner: React.FC<GameBannerProps> = ({
    gameId,
    gameType,
    createdAt,
    status = 'playing'
}) => {
    const { cancel } = useRoom();
    const isPending = status === 'pending';
    const canCancel = isPending && (gameType === '1v1' || gameType === 'free4all');

    // Format game type to be more readable
    const formattedGameType = {
        '1v1': '1 vs 1',
        '2v2': '2 vs 2',
        'free4all': 'Free for All',
        'time_trial': 'Time Trial'
    }[gameType] || gameType;

    const handleCancel = () => {
        if (cancel.isPending) {
            return;
        }
        cancel.mutate(parseInt(gameId, 10));
    };

    return (
        <View
            className={`
                mx-4 mt-4 p-3 rounded-lg flex-row items-center justify-between
                ${isPending
                    ? 'bg-[#F5F5F5] dark:bg-[#1A2227] border border-[#E5E5E5] dark:border-[#2A3136]'
                    : 'bg-[#FFF5F5] dark:bg-[#1A2227] border border-[#FECACA] dark:border-[#2A3136]'
                }
            `}
        >
            <View className="flex-row items-center gap-3">
                <View className={`
                    w-8 h-8 rounded-full justify-center items-center
                    ${isPending
                        ? 'bg-[#EBEBEB] dark:bg-[#2A3136]'
                        : 'bg-[#FEE2E2] dark:bg-[#2A3136]'
                    }
                `}>
                    {isPending ? (
                        <Clock size={20} color="#666666" />
                    ) : (
                        <Gamepad2 size={20} color="#8B0000" />
                    )}
                </View>
                <View className="gap-0.5">
                    <Text className={`
                        text-base font-semibold font-['Times New Roman']
                        ${isPending
                            ? 'text-[#666666] dark:text-[#DDE1E5]/70'
                            : 'text-[#8B0000]'
                        }
                    `}>
                        {isPending ? `Waiting for Players • ${formattedGameType}` : formattedGameType}
                    </Text>
                    <Text className="text-sm text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        Started {(() => {
                            const serverTime = new Date(createdAt);
                            const timezoneOffset = serverTime.getTimezoneOffset() * 60000; // Convert minutes to milliseconds
                            const localTime = new Date(serverTime.getTime() - timezoneOffset);
                            const minutes = Math.floor((Date.now() - localTime.getTime()) / 60000);
                            if (minutes >= 60) {
                                const hours = Math.floor(minutes / 60);
                                return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                            }
                            return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
                        })()} ago
                    </Text>
                </View>
            </View>
            {canCancel ? (
                <TouchableOpacity
                    disabled={cancel.isPending}
                    className="flex-row items-center p-2 rounded-md border border-[#FECACA] dark:border-[#2A3136] bg-[#FEF2F2] dark:bg-[#1A2227] gap-1"
                    onPress={handleCancel}
                    style={{ opacity: cancel.isPending ? 0.6 : 1 }}
                >
                    <X size={16} color="#EF4444" />
                    <Text className="text-xs text-[#EF4444] font-['Times New Roman']">Cancel</Text>
                </TouchableOpacity>
            ) : !isPending ? (
                <ChevronRight size={20} color="#666666" />
            ) : null}
        </View>
    );
};
