import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';

interface HowToPlayModalProps {
    visible: boolean;
    onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
    visible,
    onClose
}) => {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>How to Play</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#666666" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.scrollContent}>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Game Modes</Text>
                            <Text style={styles.text}>• 1v1: Challenge another player in real-time</Text>
                            <Text style={styles.text}>• 2v2: Team up and compete in pairs</Text>
                            <Text style={styles.text}>• Free for All: Every player for themselves</Text>
                        </View>
                        
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Gameplay</Text>
                            <Text style={styles.text}>1. Select letters to form words</Text>
                            <Text style={styles.text}>2. Words can be horizontal or vertical</Text>
                            <Text style={styles.text}>3. Score points for each word found</Text>
                            <Text style={styles.text}>4. Longer words earn more points</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Scoring</Text>
                            <Text style={styles.text}>• 3-letter words: 100 points</Text>
                            <Text style={styles.text}>• 4-letter words: 400 points</Text>
                            <Text style={styles.text}>• 5+ letter words: 800 points</Text>
                            <Text style={styles.text}>• Bonus points for speed!</Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: '100%',
        maxHeight: '80%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        maxHeight: '90%',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2B2B2B',
        marginBottom: 12,
        fontFamily: 'Times New Roman',
    },
    text: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 8,
        lineHeight: 24,
        fontFamily: 'Times New Roman',
    },
}); 