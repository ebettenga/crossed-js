import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface HomeSquareButtonProps {
    name?: string;
    icon?: React.ReactNode;
    onPress: () => void;
    size?: number;
    number?: number;
    customStyle?: {
        wrapper?: object;
        container?: object;
        pressed?: object;
    };
}

export const HomeSquareButton: React.FC<HomeSquareButtonProps> = ({
    name,
    icon,
    onPress,
    size = 120,
    number,
    customStyle
}) => {
    return (
        <View style={[styles.wrapper, { width: size, height: size }, customStyle?.wrapper]}>
            <Pressable 
                onPress={onPress}
                style={({ pressed }) => [
                    styles.container,
                    customStyle?.container || {
                        backgroundColor: pressed ? '#F0F0ED' : '#FAFAF7',
                    },
                    pressed && (customStyle?.pressed || {})
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
        borderWidth: 1.5,
        borderColor: '#343434',
        backgroundColor: '#FAFAF7',
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