import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
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
        <View style={styles.container}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Swords size={48} color="#8B0000" />
            </Animated.View>
            <Text style={styles.text}>Loading game...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5EB',
        gap: 16,
    },
    text: {
        fontSize: 18,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
}); 