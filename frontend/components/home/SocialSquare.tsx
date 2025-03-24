import React, { useState } from 'react';
import { View, StyleSheet, Linking, Text, Image } from 'react-native';
import { HomeSquareButton } from './HomeSquareButton';
import XLogo from '../../assets/social/x.png';
import RedditLogo from '../../assets/social/reddit.png';
import InstagramLogo from '../../assets/social/instagram.png';
import FacebookLogo from '../../assets/social/facebook.png';
import { config } from "config/config";

interface SocialSquareProps {
    size: number;
}

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
                        icon={
                            <Image
                                source={XLogo}
                                style={{ width: 24, height: 24, tintColor: config.social.twitter.color }}
                            />
                        }
                        onPress={() => openUrl(config.social.twitter.url)}
                        size={miniSquareSize}
                        iconColor={config.social.twitter.color}
                        darkIconColor={config.social.twitter.color}
                    />
                    <HomeSquareButton
                        icon={
                            <Image
                                source={RedditLogo}
                                style={{ width: 24, height: 24, tintColor: config.social.reddit.color }}
                            />
                        }
                        onPress={() => openUrl(config.social.reddit.url)}
                        size={miniSquareSize}
                        iconColor={config.social.reddit.color}
                        darkIconColor={config.social.reddit.color}
                    />
                    <HomeSquareButton
                        number={13}
                        icon={
                            <Image
                                source={InstagramLogo}
                                style={{ width: 24, height: 24, tintColor: config.social.instagram.color }}
                            />
                        }
                        onPress={() => openUrl(config.social.instagram.url)}
                        size={miniSquareSize}
                        iconColor={config.social.instagram.color}
                        darkIconColor={config.social.instagram.color}
                    />
                    <HomeSquareButton
                        icon={
                            <Image
                                source={FacebookLogo}
                                style={{ width: 24, height: 24, tintColor: config.social.facebook.color }}
                            />
                        }
                        onPress={() => openUrl(config.social.facebook.url)}
                        size={miniSquareSize}
                        iconColor={config.social.facebook.color}
                        darkIconColor={config.social.facebook.color}
                    />
                </View>
            </View>
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
