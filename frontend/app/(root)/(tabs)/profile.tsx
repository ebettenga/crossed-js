import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Users, Settings, BarChart3, CreditCard, LogOut } from 'lucide-react-native';
import { ProfileButton } from '~/components/profile/ProfileButton';
import { HomeHeader } from '~/components/home/HomeHeader';
import { useLogout } from '~/hooks/users';

export default function Profile() {
    const router = useRouter();
    const logout = useLogout();
    const handleLogout = () => {
        logout();
    };

    return (
        <View style={styles.container}>
            <HomeHeader
                username="John Doe"
                elo={1250}
                eloChange={25}
                gamesPlayed={42}
                avatarUrl="https://i.pravatar.cc/300"
                coins={100}
            />
            <ScrollView style={styles.content}>
                <View style={styles.section}>
                        <ProfileButton
                            onPress={() => router.push('/friends')}
                            label="Friends"
                            icon={<Users size={24} color="#2B2B2B" />}
                            number={3}
                        />
                    <ProfileButton
                        label="Stats"
                        icon={<BarChart3 size={24} color="#2B2B2B" />}
                        onPress={() => router.push('/stats')}
                    />
                    <ProfileButton
                        label="Settings"
                        icon={<Settings size={24} color="#2B2B2B" />}
                        onPress={() => console.log('Settings')}
                    />
                    <ProfileButton
                        label="Payment Options"
                        icon={<CreditCard size={24} color="#2B2B2B" />}
                        onPress={() => console.log('Payment')}
                    />
                </View>

                <View style={styles.bottomSection}>
                    <ProfileButton
                        label="Logout"
                        icon={<LogOut size={24} color="#8B0000" />}
                        onPress={handleLogout}
                        danger
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 16,
    },
    bottomSection: {
        marginTop: 32,
    },
});
