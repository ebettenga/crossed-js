import { View, Text, Image, StatusBar, Platform } from 'react-native'
import React, { useEffect, useMemo } from 'react'
import { Tabs } from "expo-router";
import { usePathname } from 'expo-router';
import { cn } from '~/lib/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import icons from '@/constants/icons'
import { TAB_BAR_CONTENT_HEIGHT } from '~/constants/layout';
import { useColorMode } from '~/hooks/useColorMode';
import { useChallenge } from '~/hooks/useChallenge';

const TabIcon = ({
    focused,
    icon,
    title,
    badgeCount = 0,
}: {
    focused: boolean;
    icon: any;
    title: string;
    badgeCount?: number;
}) => (
    <View className="flex-1 mt-1 flex-col items-center relative">
        <Image
            source={icon}
            tintColor={focused ? '#8B0000' : '#666876'}
            resizeMode="contain"
            className="h-6 w-6"
        />
        {badgeCount > 0 && (
            <View
                style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#8B0000',
                    borderWidth: 1,
                    borderColor: '#FFFFFF',
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Text className="text-white text-[10px] font-rubik-medium">
                    {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
            </View>
        )}
        <Text className={cn(
            "text-xs w-full text-center mt-1 font-rubik",
            focused ? "text-[#8B0000] dark:text-[#8B0000] font-rubik-medium" : "text-[#666876] dark:text-neutral-400"
        )}>
            {title}
        </Text>
    </View>
)

const TabsLayout = () => {
    const pathname = usePathname();
    const hideTabBar = pathname === '/game';
    const { isDark } = useColorMode();
    const { challenges } = useChallenge();
    const challengeCount = challenges?.length ?? 0;
    const insets = useSafeAreaInsets();

    const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + insets.bottom;
    const statusBarBackground = isDark ? '#0F1417' : '#F6FAFE';

    useEffect(() => {
        StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
        StatusBar.setTranslucent(true);
        if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor('transparent');
        }
    }, [isDark]);

    const tabBarStyle = useMemo(
        () => ({
            height: tabBarHeight,
            backgroundColor: statusBarBackground,
            position: 'absolute' as const,
            display: hideTabBar ? ('none' as const) : ('flex' as const),
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: insets.bottom,
            borderTopWidth: 1,
            borderTopColor: isDark ? '#1A2227' : '#E5E7EB',
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: -2,
            },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 3,
            elevation: 5,
        }),
        [hideTabBar, insets.bottom, isDark, statusBarBackground, tabBarHeight],
    );

    return (
        <Tabs
            screenOptions={{
                tabBarShowLabel: false,
                tabBarStyle,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.home} focused={focused} title="Home" />
                    )
                }}
            />
            <Tabs.Screen
                name="stats"
                options={{
                    title: 'Stats',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.dumbell} focused={focused} title="Stats" />
                    )
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: 'Leaderboard',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.star} focused={focused} title="Leaderboard" />
                    )
                }}
            />
            <Tabs.Screen
                name="friends"
                options={{
                    title: 'Friends',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            icon={icons.people}
                            focused={focused}
                            title="Friends"
                            badgeCount={challengeCount}
                        />
                    )
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Settings',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.edit} focused={focused} title="Settings" />
                    )
                }}
            />
        </Tabs>
    )
}
export default TabsLayout
