import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Room } from '~/hooks/useJoinRoom';
import { useUser } from '~/hooks/users';
import { Home } from 'lucide-react-native';

interface GameSummaryModalProps {
    isVisible: boolean;
    onClose: () => void;
    room: Room;
}

export const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
    isVisible,
    onClose,
    room,
}) => {
    const { data: currentUser } = useUser();

    if (!room || !currentUser) return null;

    // Find the current user's stats in the room
    const userStats = room.players.find(player => player.id === currentUser.id);
    const isWinner = room.scores[currentUser.id] === Math.max(...Object.values(room.scores));

    return (
        <Dialog style={{ borderRadius: 4 }} open={isVisible} onOpenChange={onClose}>
            <DialogContent className=" bg-[#F5F5F5] w-96 h-96 dark:bg-[#1A2227]">
                <View className="flex-1 p-4">
                    <Text className="text-2xl font-semibold text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-6">
                        Game Summary
                    </Text>

                    <View className="bg-[#F5F5F5] dark:bg-[#1A2227] rounded-lg p-6 mb-6">
                        <Text className="text-xl text-center text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman'] mb-4">
                            {isWinner ? 'Victory!' : 'Better luck next time!'}
                        </Text>

                        <View className="space-y-4">
                            <View className="flex-row justify-between">
                                <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                    Score:
                                </Text>
                                <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {room.scores[currentUser.id]}
                                </Text>
                            </View>

                            <View className="flex-row justify-between">
                                <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                    Rating:
                                </Text>
                                <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {userStats?.eloRating || 0}
                                </Text>
                            </View>

                            <View className="flex-row justify-between">
                                <Text className="text-[#666666] dark:text-[#9CA3AF] font-['Times_New_Roman']">
                                    Game Type:
                                </Text>
                                <Text className="text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times_New_Roman']">
                                    {room.type === '1v1' ? '1 vs 1' : room.type === '2v2' ? '2 vs 2' : 'Free for All'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={onClose}
                        className="flex-row items-center justify-center bg-[#8B0000] p-4 rounded-lg"
                    >
                        <Home size={20} color="#FFFFFF" className="mr-2" />
                        <Text className="text-white font-['Times_New_Roman']">
                            Return Home
                        </Text>
                    </TouchableOpacity>
                </View>
            </DialogContent>
        </Dialog>
    );
};
