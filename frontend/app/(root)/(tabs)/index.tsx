import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Swords, Group } from 'lucide-react-native';
import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { HomeHeader } from '~/components/home/HomeHeader';
import { SocialSquare } from '~/components/home/SocialSquare';
import { GameBanner } from '~/components/home/GameBanner';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 6;
const GAP = 3;
const SQUARES_PER_ROW = 2;

// Calculate button size to fit 2 per row with padding and gap
const BUTTON_SIZE = (SCREEN_WIDTH - (PADDING * 2) - (GAP * (SQUARES_PER_ROW - 1))) / SQUARES_PER_ROW;

export default function Home() {
    const router = useRouter();
    const hasActiveGame = true; // This should come from your game state management

    return (
        <View style={styles.container}>
            <HomeHeader 
                username="John Doe"
                elo={1250}
                eloChange={25}
                gamesPlayed={42}
                avatarUrl="https://i.pravatar.cc/300"
                coins={100}
            />
            {hasActiveGame && (
                <GameBanner 
                    gameId="123"
                    opponent="Jane Smith"
                />
            )}
            <View style={styles.grid}>
                <HomeSquareButton
                    name="1 v 1"
                    icon={<Users size={24} color="#2B2B2B" />}
                    onPress={() => router.push('/game')}
                    number={1}
                    size={BUTTON_SIZE}
                />
                <HomeSquareButton
                    name="2 v 2"
                    icon={<Group size={24} color="#2B2B2B" />}
                    onPress={() => console.log('2 v 2')}
                    size={BUTTON_SIZE}
                />
                <HomeSquareButton
                    name="Free for All"
                    icon={<Swords size={24} color="#2B2B2B" />}
                    onPress={() => console.log('Free for All')}
                    size={BUTTON_SIZE}
                />
                <SocialSquare size={BUTTON_SIZE} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    grid: {
        padding: PADDING,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        marginTop: 16, // Add some space after the banner
    },
});
