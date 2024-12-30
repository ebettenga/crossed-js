import React, { useEffect, useState } from 'react';
import { Modal, View } from "react-native";
import Animated, { 
    useAnimatedStyle, 
    withRepeat, 
    withSequence, 
    withTiming,
    withDelay,
    withSpring
} from 'react-native-reanimated';
import { Search } from 'lucide-react-native';
import { Text } from '~/components/ui/text'; 
import { Text as RNText } from 'react-native';

interface FindingGameModalProps {
    visible: boolean;
}

export function FindingGameModal({ visible }: FindingGameModalProps) {
    const text = "Finding a game...".split('');
    const [jokeIndex, setJokeIndex] = useState(0);

    const jokes = [
        "Searching for someone who's ACROSS the world...",
        "WORD on the street is your opponent is nearby...",
        "CROSSING paths with your next opponent...",
        "PUZZLING over who to match you with...",
        "Looking for someone to share a WORD with...",
        "DOWN to find you the perfect match...",
        "Scanning the GRID for worthy opponents...",
        "Checking who's ready to SQUARE off...",
        "CLUEing you in to your next match soon...",
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setJokeIndex((current) => (current + 1) % jokes.length);
        }, 7000);

        return () => clearInterval(interval);
    }, []);

    // Letter animation
    const createLetterStyle = (index: number) => useAnimatedStyle(() => ({
        transform: [{
            scale: withRepeat(
                withDelay(
                    // Outer delay to create pause between waves
                    2000,
                    withDelay(
                        // Inner delay for wave effect
                        index * 50,
                        withSequence(
                            withTiming(1.4, { duration: 200 }),
                            withTiming(1, { duration: 200 })
                        )
                    )
                ),
                -1,
                true
            )
        }]
    }));

    const renderJokeText = (text: string) => {
        const words = text.split(' ');
        return (
            <Text className="text-sm text-gray-500 pt-10 pb-3 text-center">
                {words.map((word, index) => {
                    const isUpperCase = word === word.toUpperCase() && word.length > 1;
                    return (
                        <RNText key={index}>
                            <RNText 
                                style={{ 
                                    color: isUpperCase ? '#ef4444' : '#6b7280'
                                }}
                            >
                                {word}
                            </RNText>
                            {index < words.length - 1 ? ' ' : ''}
                        </RNText>
                    );
                })}
            </Text>
        );
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
        >
            <View className="flex-1 justify-center items-center bg-black/50">
                <View className="items-center">
                    {/* Center content */}
                    <View className="bg-white/90 backdrop-blur-md p-6 rounded-2xl items-center space-y-4 w-72">

                        <View className="flex-row justify-center">
                            {text.map((letter, index) => (
                                <Animated.Text
                                    key={index}
                                    style={[createLetterStyle(index)]}
                                    className="text-lg font-semibold text-gray-800"
                                >
                                    {letter}
                                </Animated.Text>
                            ))}
                        </View>

                        {renderJokeText(jokes[jokeIndex])}
                    </View>
                </View>
            </View>
        </Modal>
    );
}