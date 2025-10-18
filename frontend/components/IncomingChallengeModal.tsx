import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, Pressable } from 'react-native';
import { Swords, X } from 'lucide-react-native';
import { useChallenge } from '~/hooks/useChallenge';
import { showToast } from '~/components/shared/Toast';
import { Portal } from '@rn-primitives/portal';

export const IncomingChallengeModal = () => {
    const {
        incomingChallenge,
        clearIncomingChallenge,
        acceptChallenge,
        rejectChallenge,
    } = useChallenge();

    const isVisible = incomingChallenge?.context === 'rematch';
    const isAccepting = acceptChallenge.isPending;
    const isRejecting = rejectChallenge.isPending;
    const isBusy = isAccepting || isRejecting;

    const handleClose = () => {
        if (isBusy) return;
        clearIncomingChallenge();
    };

    const handleAccept = async () => {
        if (!incomingChallenge || isBusy) return;
        try {
            await acceptChallenge.mutateAsync(incomingChallenge.room.id);
            clearIncomingChallenge();
            showToast('success', 'Rematch accepted!');
        } catch (error) {
            showToast('error', 'Failed to accept rematch');
        }
    };

    const handleReject = async () => {
        if (!incomingChallenge || isBusy) return;
        try {
            await rejectChallenge.mutateAsync(incomingChallenge.room.id);
            clearIncomingChallenge();
            showToast('info', 'Rematch declined');
        } catch (error) {
            showToast('error', 'Failed to decline rematch');
        }
    };

    if (!isVisible) {
        return null;
    }

    const challengerName = incomingChallenge?.challenger?.username ?? 'Opponent';
    const difficulty = incomingChallenge?.room?.difficulty ?? '';

    return (
        <Portal name='incoming-challenge-modal'>
            <View className="absolute inset-0 z-50">
                <Pressable
                    className="absolute inset-0 bg-black/50"
                    onPress={handleClose}
                    disabled={isBusy}
                />
                <View className="flex-1 w-full h-full items-center justify-center px-6">
                    <View className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1A2227] p-6 border border-[#E5E5E5] dark:border-[#2A3136]">
                        <View className="items-center mb-4">
                            <View className="w-12 h-12 rounded-full bg-[#8B0000] items-center justify-center mb-3">
                                <Swords size={28} color="#FFFFFF" />
                            </View>
                            <Text className="text-2xl text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                                Rematch Request
                            </Text>
                            <Text className="text-sm text-center text-[#4B4B4B] dark:text-[#DDE1E5]/70 font-['Times New Roman'] mt-2">
                                {challengerName} wants a {difficulty} rematch. Ready to play again?
                            </Text>
                        </View>

                        <View className="flex-row justify-between gap-3">
                            <TouchableOpacity
                                className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-[#FECACA] dark:border-[#2A3136] bg-[#FEF2F2] dark:bg-[#1A2227] py-2"
                                onPress={handleReject}
                                disabled={isBusy}
                                activeOpacity={0.8}
                            >
                                {isRejecting ? (
                                    <ActivityIndicator size="small" color="#EF4444" />
                                ) : (
                                    <>
                                        <X size={18} color="#EF4444" />
                                        <Text className="text-[#EF4444] font-['Times New Roman'] text-sm">
                                            Decline
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-[#BBF7D0] dark:border-[#2A3136] bg-[#F0FDF4] dark:bg-[#1A2227] py-2"
                                onPress={handleAccept}
                                disabled={isBusy}
                                activeOpacity={0.8}
                            >
                                {isAccepting ? (
                                    <ActivityIndicator size="small" color="#34D399" />
                                ) : (
                                    <>
                                        <Swords size={18} color="#34D399" />
                                        <Text className="text-[#34D399] font-['Times New Roman'] text-sm">
                                            Accept
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Portal>
    );
};
