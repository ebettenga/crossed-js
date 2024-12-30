import React from 'react';
import { Modal, View, StyleSheet, ActivityIndicator, Text } from 'react-native';

interface ConnectionModalProps {
    visible: boolean;
    message?: string;
}

export function ConnectionModal({ visible, message = 'Connecting to game...' }: ConnectionModalProps) {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <ActivityIndicator size="large" color="#0066CC" />
                    <Text style={styles.message}>{message}</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        gap: 16,
    },
    message: {
        fontSize: 16,
        color: '#2B2B2B',
        textAlign: 'center',
    },
});