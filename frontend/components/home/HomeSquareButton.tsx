import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface HomeSquareButtonProps {
    name?: string;
    icon?: React.ReactNode;
    onPress: () => void;
    size?: number;
    number?: number;
}

export const HomeSquareButton: React.FC<HomeSquareButtonProps> = ({
    name,
    icon,
    onPress,
    size = 120,
    number
}) => {
    return (
        <View style={[styles.wrapper, { width: size, height: size }]}>
            <Pressable 
                onPress={onPress}
                style={({ pressed }) => [
                    styles.container,
                    {
                        backgroundColor: pressed ? '#E6E6DC' : '#F8F8F5',
                    }
                ]}
            >
                {number !== undefined && (
                    <Text style={styles.number}>{number}</Text>
                )}
                <View style={styles.content}>
                    {icon && (
                        <View style={styles.iconContainer}>
                            {icon}
                        </View>
                    )}
                    {name && (
                        <Text style={styles.text}>{name}</Text>
                    )}
                </View>
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        borderWidth: 2,
        borderColor: '#666666',
        backgroundColor: '#F8F8F5',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',

    },
    content: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: 4,
    },
    text: {
        color: '#2B2B2B',
        fontSize: 16,
        fontFamily: 'Times New Roman',
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    number: {
        position: 'absolute',
        top: 4,
        left: 4,
        fontSize: 12,
        fontFamily: 'Times New Roman',
        color: '#666666',
        fontWeight: '500',
    },
}); 