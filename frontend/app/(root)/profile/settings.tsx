import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { PageHeader } from '~/components/Header';
import { Switch } from '~/components/ui/switch';
import { Moon, Sun, ChevronLeft, ChevronRight, Volume2, VolumeX, Eye, EyeOff, HelpCircle, Sparkles, Vibrate } from 'lucide-react-native';
import { useColorMode } from '~/hooks/useColorMode';
import { useSoundPreference } from '~/hooks/useSoundPreference';
import { useEloVisibility } from '~/hooks/useEloVisibility';
import { useRouter } from 'expo-router';
import { useHapticsPreference } from '~/hooks/useHapticsPreference';
import { useHaptics } from '~/hooks/useHaptics';

export default function Settings() {
    const { isDark } = useColorMode();
    const { isSoundEnabled, setSoundEnabled } = useSoundPreference();
    const { isHapticsEnabled, setHapticsEnabled } = useHapticsPreference();
    const { isEloVisible, setEloVisibility } = useEloVisibility();
    const { previewSelection } = useHaptics();
    const router = useRouter();

    const toggleSound = () => {
        setSoundEnabled(!isSoundEnabled);
    };

    const toggleHaptics = () => {
        if (!isHapticsEnabled) {
            previewSelection();
        }
        setHapticsEnabled(!isHapticsEnabled);
    };

    const toggleEloVisibility = () => {
        setEloVisibility(!isEloVisible);
    };

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
            <PageHeader />

            <TouchableOpacity
                className="flex-row items-center px-4 py-3"
                onPress={() => router.push('/profile')}
            >
                <ChevronLeft size={24} color={isDark ? '#DDE1E5' : '#2B2B2B'} />
                <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] ml-1 font-rubik">
                    Back
                </Text>
            </TouchableOpacity>

            <ScrollView className="flex-1 px-4">
                <View className="mt-8">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                        Game Settings
                    </Text>

                    <View className="mt-4 bg-white dark:bg-[#1A2227] rounded-lg p-4 gap-4">
                        <TouchableOpacity
                            className="flex-row items-center justify-between"
                            onPress={toggleSound}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-3">
                                {isSoundEnabled ? (
                                    <Volume2 size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                ) : (
                                    <VolumeX size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                )}
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                                    Sound Effects
                                </Text>
                            </View>
                            <Switch checked={isSoundEnabled} onCheckedChange={toggleSound} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-row items-center justify-between"
                            onPress={toggleHaptics}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-3">
                                <Vibrate size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                                    Haptics
                                </Text>
                            </View>
                            <Switch checked={isHapticsEnabled} onCheckedChange={toggleHaptics} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="flex-row items-center justify-between"
                            onPress={toggleEloVisibility}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-3">
                                {isEloVisible ? (
                                    <Eye size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                ) : (
                                    <EyeOff size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                )}
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                                    Show ELO Rating
                                </Text>
                            </View>
                            <Switch checked={isEloVisible} onCheckedChange={toggleEloVisibility} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="mt-10">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                        Learn & Support
                    </Text>

                    <View className="mt-4 bg-white dark:bg-[#1A2227] rounded-lg p-4 gap-4">
                        <TouchableOpacity
                            className="flex-row items-center justify-between"
                            onPress={() => router.push('/(root)/how-to-play')}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-3">
                                <HelpCircle size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                                    How to Play
                                </Text>
                            </View>
                            <ChevronRight size={20} color={isDark ? '#DDE1E5' : '#1D2124'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-row items-center justify-between"
                            onPress={() => router.push('/profile/credits')}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-3">
                                <Sparkles size={24} color={isDark ? '#DDE1E5' : '#1D2124'} />
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                                    Credits
                                </Text>
                            </View>
                            <ChevronRight size={20} color={isDark ? '#DDE1E5' : '#1D2124'} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
