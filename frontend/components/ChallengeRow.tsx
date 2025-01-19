import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Swords, X } from 'lucide-react-native';
import { Room } from '~/hooks/useJoinRoom';

type ChallengeRowProps = {
    room: Room;
    challenger?: boolean;
    username?: string;
    onAccept?: (roomId: number) => void;
    onReject?: (roomId: number) => void;
    isAccepting?: boolean;
    isRejecting?: boolean;
};

export const ChallengeRow = ({
    room,
    challenger,
    username,
    onAccept,
    onReject,
    isAccepting = false,
    isRejecting = false
}: ChallengeRowProps) => {
    return (
        <View className="flex-row items-center justify-between bg-[#F8F8F5] dark:bg-[#1A2227] p-3 rounded-xl border border-[#E5E5E5] dark:border-[#2A3136]">
            <View className="flex-1 flex-row items-center gap-3">
                <View className="relative">
                    <View className="w-10 h-10 rounded-full bg-[#8B0000] items-center justify-center">
                        <Text className="text-white text-lg font-bold font-['Times New Roman']">
                            {username?.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                </View>
                <View className="flex-1">
                    <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                        {username}
                    </Text>
                    <Text className="text-xs text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        {challenger ? `You've challenged ${username} to a ${room.difficulty} game!` : `${username} wants to play a ${room.difficulty} game!`}
                    </Text>
                </View>
            </View>

            {(onAccept || onReject) && (
                <View className="flex-row items-center gap-1.5 pl-3">
                    {onAccept && (
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
                    )}
                    {onReject && (
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
                    )}
                </View>
            )}
        </View>
    );
};
