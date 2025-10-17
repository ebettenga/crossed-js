import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { PageHeader } from '~/components/Header';
import { SupportContent } from '~/components/support/SupportContent';
import { useColorMode } from '~/hooks/useColorMode';

export default function Support() {
    const { isDark } = useColorMode();
    const router = useRouter();
    const params = useLocalSearchParams<{ type?: string; comment?: string }>();

    return (
        <>
            <PageHeader />

            <TouchableOpacity
                className="flex-row items-center px-4 py-3 dark:bg-[#0F1417]"
                onPress={() => router.push('/profile')}
            >
                <ChevronLeft size={24} color={isDark ? 'white' : 'black'} className="text-foreground" />
                <Text className="text-base text-foreground ml-1 dark:text-white">
                    Back
                </Text>
            </TouchableOpacity>

            <SupportContent
                header={<></>}
                onClose={() => router.push('/profile')}
                initialType={params.type as any || 'support'}
                initialComment={params.comment || ''}
            />
        </>
    );
}
