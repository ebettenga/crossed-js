import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { User } from '~/hooks/users';



interface AvatarProps {
    user: User;
    size?: number;
    imageUrl?: string | null;
}

export const Avatar: React.FC<AvatarProps> = ({ user, size = 32, imageUrl }) => {
    // Get initials from username
    const initials = user.username
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    if (imageUrl) {
        return (
            <Image
                source={{ uri: imageUrl }}
                style={[
                    styles.image,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                    }
                ]}
            />
        );
    }

    return (
        <View style={[
            styles.container,
            {
                width: size,
                height: size,
                borderRadius: size / 2,
            }
        ]}>
            <Text style={[
                styles.initials,
                { fontSize: size * 0.4 }
            ]}>
                {initials}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#8B0000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        backgroundColor: '#8B0000',
    },
    initials: {
        color: '#FFFFFF',
        fontWeight: '500',
        fontFamily: 'Rubik-Regular',
    },
});
