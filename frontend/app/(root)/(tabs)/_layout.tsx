import { View, Text, Image } from 'react-native'
import React from 'react'
import { Tabs } from "expo-router";
import { usePathname } from 'expo-router';

import icons from '@/constants/icons'

const TabIcon = ({ focused, icon, title }: { focused: boolean; icon: any; title: string }) => (
    <View className="flex-1 mt-3 flex flex-col items-center">
        <Image 
            source={icon} 
            tintColor={focused ? '#8B0000' : '#666876'} 
            resizeMode="contain" 
            className="size-6" 
        />
        <Text className={`${focused ? 
            'text-[#666666] font-rubik-medium' : 'text-black-200 font-rubik'} text-xs w-full text-center mt-1`}>
            {title}
        </Text>
    </View>
)

const TabsLayout = () => {
    const pathname = usePathname();
    const hideTabBar = pathname === '/game';

    return (
        <Tabs
            screenOptions={{
                tabBarShowLabel: false,
                tabBarStyle: {
                    backgroundColor: 'white',
                    position: 'absolute',
                    borderTopColor: '#0061FF1A',
                    borderTopWidth: 1,
                    minHeight: 70,
                    display: hideTabBar ? 'none' : 'flex',
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
                name="explore"
                options={{
                    title: 'Explore',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.search} focused={focused} title="Explore" />
                    )
                }}
            />
            <Tabs.Screen
                name="store"
                options={{
                    title: 'Store',
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon icon={icons.wallet} focused={focused} title="Store" />
                    )
                }}
            />
            <Tabs.Screen
                name="settings"
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
