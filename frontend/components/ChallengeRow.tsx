import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Swords, X } from 'lucide-react-native';
import { Player, Room } from '~/hooks/useRoom';
import { User } from '~/hooks/users';

type ChallengeRowProps = {
    room: Room;
    user: User;
    challenger?: Player;
    onAccept: (roomId: number) => void;
    onReject: (roomId: number) => void;
    isAccepting?: boolean;
    isRejecting?: boolean;
};

export const ChallengeRow = ({
    room,
    user,
    challenger,
    onAccept,
    onReject,
    isAccepting = false,
    isRejecting = false
}: ChallengeRowProps) => {
    if (!challenger) return null;

    return (
        <View className="flex-row items-center justify-between bg-[#F8F8F5] dark:bg-[#1A2227] p-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A3136]">
            <View className="flex-1 flex-row items-center gap-3">
                <View className="relative">
                    <Image
                        source={{ uri: 'https://i.pravatar.cc/150' }}
                        className="w-10 h-10 rounded-full bg-[#F5F5EB] dark:bg-[#2A3136]"
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                        {challenger.username}
                    </Text>
                    <Text className="text-xs text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        wants to play a {room.difficulty} game!
                    </Text>
                </View>
            </View>

            <View className="flex-row items-center gap-1.5 pl-3">
                <TouchableOpacity
                    className="flex-row items-center p-2 rounded-md border border-[#BBF7D0] dark:border-[#2A3136] bg-[#F0FDF4] dark:bg-[#1A2227] gap-1"
                    onPress={() => onAccept(room.id)}
                    disabled={isAccepting || isRejecting}
                >
                    {isAccepting ? (
                        <ActivityIndicator size="small" color="#34D399" />
                    ) : (
                        <>
                            <Swords size={16} color="#34D399" />
                            <Text className="text-xs text-[#34D399] font-['Times New Roman']">Accept</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-row items-center p-2 rounded-md border border-[#FECACA] dark:border-[#2A3136] bg-[#FEF2F2] dark:bg-[#1A2227] gap-1"
                    onPress={() => onReject(room.id)}
                    disabled={isAccepting || isRejecting}
                >
                    {isRejecting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                        <>
                            <X size={16} color="#EF4444" />
                            <Text className="text-xs text-[#EF4444] font-['Times New Roman']">Decline</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};
