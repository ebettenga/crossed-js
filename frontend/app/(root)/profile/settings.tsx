import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { PageHeader } from '~/components/Header';
import { Switch } from '~/components/ui/switch';
import { Moon, Sun, ChevronLeft, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react-native';
import { useColorMode } from '~/hooks/useColorMode';
import { useSound } from '~/hooks/useSound';
import { useEloVisibility } from '~/hooks/useEloVisibility';
import { useRouter } from 'expo-router';
import { storage } from '~/hooks/storageApi';

export default function Settings() {
    const { isDark, setColorScheme } = useColorMode();
    const { isSoundEnabled, setSoundEnabled } = useSound();
    const { isEloVisible, setEloVisibility } = useEloVisibility();
    const router = useRouter();
    const [isSystemTheme, setIsSystemTheme] = React.useState(false);

    React.useEffect(() => {
        const checkTheme = async () => {
            const savedScheme = await storage.getString('color-scheme');
            setIsSystemTheme(savedScheme === 'system');
        };
        checkTheme();
    }, []);

    const toggleColorScheme = () => {
        setColorScheme(isDark ? 'light' : 'dark');
        setIsSystemTheme(false);
    };

    const resetToSystemTheme = () => {
        setColorScheme('system');
        setIsSystemTheme(true);
    };

    const toggleSound = () => {
        setSoundEnabled(!isSoundEnabled);
    };

    const toggleEloVisibility = () => {
        setEloVisibility(!isEloVisible);
    };

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
            <PageHeader />

            <TouchableOpacity
                className="flex-row items-center px-4 py-3"
                onPress={() => router.back()}
            >
                <ChevronLeft size={24} color={isDark ? '#DDE1E5' : '#2B2B2B'} />
                <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] ml-1 font-['Times New Roman']">
                    Back
                </Text>
            </TouchableOpacity>

            <ScrollView className="flex-1 px-4">
                <View className="mt-4">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                        Appearance
                    </Text>

                    <View className="mt-4 bg-white dark:bg-[#1A2227] rounded-lg p-4">
                        <TouchableOpacity
                            className="flex-row items-center justify-between"
                            onPress={toggleColorScheme}
                            activeOpacity={0.7}
                        >
                            <View className="flex-row items-center gap-3">
                                {isDark ? (
                                    <Moon size={24} color="#DDE1E5" />
                                ) : (
                                    <Sun size={24} color="#1D2124" />
                                )}
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                                    Dark Mode {isSystemTheme ? '(System)' : ''}
                                </Text>
                            </View>
                            <Switch checked={isDark} onCheckedChange={toggleColorScheme} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={resetToSystemTheme}
                            className="mt-2"
                        >
                            <Text className="text-sm text-[#666666] dark:text-neutral-400 text-center font-['Times New Roman']">
                                Reset to System Default
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="mt-8">
                    <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
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
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                                    Sound Effects
                                </Text>
                            </View>
                            <Switch checked={isSoundEnabled} onCheckedChange={toggleSound} />
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
                                <Text className="text-base text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                                    Show ELO Rating
                                </Text>
                            </View>
                            <Switch checked={isEloVisible} onCheckedChange={toggleEloVisibility} />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
