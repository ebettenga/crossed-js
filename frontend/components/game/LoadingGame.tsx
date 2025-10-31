import React, { useEffect } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Swords } from 'lucide-react-native';

export const LoadingGame: React.FC = () => {
    const spinValue = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <View className="flex-1 justify-center items-center bg-[#F6FAFE] dark:bg-[#0F1417] gap-4">
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Swords size={48} color='#8B0000' />
            </Animated.View>
            <Text className="text-lg text-[#1D2124] dark:text-[#DDE1E5] font-rubik">
                Loading game...
            </Text>
        </View>
    );
};
