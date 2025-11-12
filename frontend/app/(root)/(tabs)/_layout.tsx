import { View, Text, Image, StatusBar, Platform } from 'react-native'
import React, { useEffect } from 'react'
import { Tabs } from "expo-router";
import { usePathname } from 'expo-router';
import { cn } from '~/lib/utils';

import icons from '@/constants/icons'
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
    <View className="flex-1 mt-3 flex-col items-center relative">
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
    const isIOS = Platform.OS === 'ios';

    useEffect(() => {
        StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
        StatusBar.setTranslucent(true);
    }, [isDark]);

    const height = __DEV__ ? 70 : 120

    return (
        <Tabs
            screenOptions={{
                tabBarShowLabel: false,
                tabBarSafeAreaInsets: { bottom: 0 },
                tabBarStyle: {
                    height: height,
                    backgroundColor: isDark ? '#0F1417' : '#F6FAFE',
                    position: 'absolute',
                    display: hideTabBar ? 'none' : 'flex',
                    bottom: isIOS ? -12 : 0,
                    paddingBottom: isIOS ? 24 : 12,
                    shadowColor: '#000',
                    shadowOffset: {
                        width: 0,
                        height: -2,
                    },
                    shadowOpacity: isDark ? 0.3 : 0.1,
                    shadowRadius: 3,
                    elevation: 5,
                }
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
