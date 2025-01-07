import React, { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Twitter, Youtube, Facebook, Swords } from 'lucide-react-native';
import { HomeSquareButton } from './HomeSquareButton';
import { TournamentInfoModal } from './TournamentInfoModal';

interface SocialSquareProps {
    size: number;
}

// Official brand colors
const TWITTER_BLUE = '#1DA1F2';
const YOUTUBE_RED = '#FF0000';
const FACEBOOK_BLUE = '#1877F2';

export const SocialSquare: React.FC<SocialSquareProps> = ({ size }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const miniSquareSize = (size - 3) / 2;

    const openUrl = (url: string) => {
        Linking.openURL(url);
    };

    return (
        <>
            <View style={[styles.container, { width: size, height: size }]}>
                <View style={styles.grid}>
                    <HomeSquareButton
                        icon={<Swords size={16} />}
                        onPress={() => setModalVisible(true)}
                        size={miniSquareSize}
                        iconColor="#FFFFFF"
                        darkIconColor="#FFFFFF"
                        customStyle={{
                            wrapper: "bg-black dark:bg-black border-black dark:border-black",
                            container: "bg-black dark:bg-black",
                            pressed: "bg-neutral-800 dark:bg-neutral-800"
                        }}
                    />
                    <HomeSquareButton
                        icon={<Twitter size={16} />}
                        onPress={() => openUrl('https://twitter.com')}
                        size={miniSquareSize}
                        iconColor={TWITTER_BLUE}
                        darkIconColor={TWITTER_BLUE}
                    />
                    <HomeSquareButton
                        number={13}
                        icon={<Youtube size={16} />}
                        onPress={() => openUrl('https://youtube.com')}
                        size={miniSquareSize}
                        iconColor={YOUTUBE_RED}
                        darkIconColor={YOUTUBE_RED}
                    />
                    <HomeSquareButton
                        icon={<Facebook size={16} />}
                        onPress={() => openUrl('https://facebook.com')}
                        size={miniSquareSize}
                        iconColor={FACEBOOK_BLUE}
                        darkIconColor={FACEBOOK_BLUE}
                    />
                </View>
            </View>
            <TournamentInfoModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
    },
    grid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
});
