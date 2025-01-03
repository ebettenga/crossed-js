import React, { useState } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { Twitter, Youtube, Facebook, HelpCircle } from 'lucide-react-native';
import { HomeSquareButton } from './HomeSquareButton';
import { HowToPlayModal } from './HowToPlayModal';

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
                        icon={<Twitter size={16} color={TWITTER_BLUE} />}
                        onPress={() => openUrl('https://twitter.com')}
                        size={miniSquareSize}
                    />
                    <HomeSquareButton
                        number={13}
                        icon={<Youtube size={16} color={YOUTUBE_RED} />}
                        onPress={() => openUrl('https://youtube.com')}
                        size={miniSquareSize}
                    />
                    <HomeSquareButton
                        icon={<Facebook size={16} color={FACEBOOK_BLUE} />}
                        onPress={() => openUrl('https://facebook.com')}
                        size={miniSquareSize}
                    />
                    <HomeSquareButton
                        icon={<HelpCircle size={16} color="#666666" />}
                        onPress={() => setModalVisible(true)}
                        size={miniSquareSize}
                    />
                </View>
            </View>
            <HowToPlayModal
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