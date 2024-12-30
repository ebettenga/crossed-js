import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

interface ProfileButtonProps {
    label: string;
    icon: React.ReactNode;
    onPress?: () => void;
    number?: number;
    danger?: boolean;
}

export const ProfileButton: React.FC<ProfileButtonProps> = ({
    label,
    icon,
    onPress,
    number,
    danger = false
}) => {
    return (
        <TouchableOpacity 
            style={[
                styles.container,
                danger && styles.dangerButton
            ]}
            onPress={onPress}
        >
            <View style={styles.content}>
                {number !== undefined && (
                    <Text style={[
                        styles.number,
                        danger && styles.dangerText
                    ]}>{number}</Text>
                )}
                <View style={styles.iconContainer}>
                    {icon}
                </View>
                <Text style={[
                    styles.label,
                    danger && styles.dangerText
                ]}>{label}</Text>
            </View>
            <ChevronRight size={20} color={danger ? '#8B0000' : '#666666'} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 56,
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    dangerButton: {
        backgroundColor: '#FFF5F5',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 24,
        alignItems: 'center',
    },
    label: {
        fontSize: 16,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    dangerText: {
        color: '#8B0000',
    },
    number: {
        position: 'absolute',
        top: -8,
        left: -8,
        fontSize: 12,
        fontFamily: 'Times New Roman',
        color: '#666666',
        fontWeight: '500',
    },
}); 