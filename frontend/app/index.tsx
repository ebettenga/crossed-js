import 'react-native-reanimated';
import React, { useState } from 'react'
import { SafeAreaView } from "react-native";
import { useRouter } from 'expo-router';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { FindingGameModal } from '~/components/FindingGameModal';

export default function Index() {
    const router = useRouter();
    const [isSearching, setIsSearching] = useState(false);

    const handleFindGame = () => {
        setIsSearching(true);
        // Add your game finding logic here
        // For demo purposes, let's simulate finding a game after 3 seconds
        setTimeout(() => {
            setIsSearching(false);
            router.push('/game');
        }, 1000);
    };

    return (
        <SafeAreaView className="flex-1">
            <Button onPress={handleFindGame}>
                <Text>Find Game</Text>
            </Button>

            <FindingGameModal visible={isSearching} />
        </SafeAreaView>
    )
}
