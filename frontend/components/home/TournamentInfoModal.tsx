import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';

interface TournamentInfoModalProps {
    visible: boolean;
    onClose: () => void;
}

export const TournamentInfoModal: React.FC<TournamentInfoModalProps> = ({
    visible,
    onClose
}) => {
    return (
        <Modal
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Crossed Elimination Tournaments</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#2B2B2B" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.content}>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>What are Crossed Tournaments?</Text>
                            <Text style={styles.text}>
                                Crossed Elimination Tournaments are competitive events where players face off in a series of word-guessing matches. Players are eliminated through a bracket system until a champion emerges.
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>How it Works</Text>
                            <Text style={styles.text}>
                                • Players are matched in brackets{'\n'}
                                • Win your match to advance{'\n'}
                                • Lose once and you're eliminated{'\n'}
                                • Last player standing wins{'\n'}
                                • ELO ratings affect seeding
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Rewards</Text>
                            <Text style={styles.text}>
                                • Tournament winner titles{'\n'}
                                • Special profile badges{'\n'}
                                • Increased ELO gains{'\n'}
                                • Seasonal leaderboard position
                            </Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Coming Soon!</Text>
                            <Text style={styles.text}>
                                Tournaments are currently in development. Stay tuned for the launch of our first official tournament season!
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
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
    content: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2B2B2B',
        marginBottom: 8,
        fontFamily: 'Times New Roman',
    },
    text: {
        fontSize: 16,
        color: '#666666',
        lineHeight: 24,
        fontFamily: 'Times New Roman',
    },
}); 