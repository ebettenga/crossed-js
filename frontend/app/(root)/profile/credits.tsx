import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { PageHeader } from '~/components/Header';
import { useColorMode } from '~/hooks/useColorMode';

export default function Credits() {
    const router = useRouter();
    const { isDark } = useColorMode();

    const handleOpenCadien = () => {
        Linking.openURL('https://open.spotify.com/artist/6qkkqxyqLSZHoeimJ7XwQe');
    };

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
            <PageHeader />

            <TouchableOpacity
                className="flex-row items-center px-4 py-3"
                onPress={() => router.push('/profile/settings')}
            >
                <ChevronLeft size={24} color={isDark ? '#DDE1E5' : '#2B2B2B'} />
                <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] ml-1 font-['Times New Roman']">
                    Back to Settings
                </Text>
            </TouchableOpacity>

            <ScrollView className="flex-1 px-4">
                <View className="mt-8 bg-white dark:bg-[#1A2227] rounded-lg p-4 gap-6">
                    <View className="gap-2">
                        <Text className="text-lg font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                            Credits
                        </Text>
                        <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                            Huge thanks to everyone who helps make CrossedJS special.
                        </Text>
                    </View>

                    <View className="gap-3">
                        <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                            Music
                        </Text>
                        <TouchableOpacity
                            className="flex-row items-center gap-2"
                            activeOpacity={0.7}
                            onPress={handleOpenCadien}
                        >
                            <ExternalLink size={18} color={isDark ? '#DDE1E5' : '#1D2124'} />
                            <Text className="text-base text-[#8B0000] dark:text-[#E39B9B] font-['Times New Roman']">
                                cadien — listen on Spotify
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                        <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                            Testers
                        </Text>
                        <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                            jacjacbettenga
                        </Text>
                        <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                            Zackypoo
                        </Text>
                    </View>

                    <View className="gap-2">
                        <Text className="text-base font-semibold text-[#1D2124] dark:text-[#DDE1E5] font-['Times New Roman']">
                            Creator
                        </Text>
                        <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                            zero
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
