import { View, Text, Image, StatusBar } from 'react-native'
import React, { useEffect } from 'react'
import { Tabs } from "expo-router";
import { usePathname } from 'expo-router';
import { cn } from '~/lib/utils';

import icons from '@/constants/icons'
import { useColorMode } from '~/hooks/useColorMode';

const TabIcon = ({ focused, icon, title }: { focused: boolean; icon: any; title: string }) => (
    <View className="flex-1 mt-3 flex-col items-center">
        <Image
            source={icon}
            tintColor={focused ? '#8B0000' : '#666876'}
            resizeMode="contain"
            className="h-6 w-6"
        />
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

    useEffect(() => {
        StatusBar.setBackgroundColor(isDark ? '#0F1417' : '#F6FAFE');
        StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    }, [isDark]);

    const height = __DEV__ ? 70 : 0

    return (
        <Tabs
            screenOptions={{
                tabBarShowLabel: false,
                tabBarStyle: {
                    height: height,
                    backgroundColor: isDark ? '#0F1417' : '#F6FAFE',
                    position: 'absolute',
                    display: hideTabBar ? 'none' : 'flex',
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
                name="friends"
                options={{
                    title: 'Friends',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.people} focused={focused} title="Friends" />
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
