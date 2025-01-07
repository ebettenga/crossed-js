import React from 'react';
import { View, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Users, Settings, BarChart3, CreditCard, LogOut, UserCog, HelpCircle } from 'lucide-react-native';
import { ProfileButton } from '~/components/profile/ProfileButton';
import { PageHeader } from '~/components/Header';
import { useLogout, useUser } from '~/hooks/users';

export default function Profile() {
    const router = useRouter();
    const logout = useLogout();
    const { data: user } = useUser();

    const handleLogout = async () => {
        await logout();
    };

    if (!user) return null;

    return (
        <View className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
            <PageHeader />
            <ScrollView className="flex-1">
                <View>
                    <ProfileButton
                        onPress={() => router.push('/profile/edit')}
                        label="Edit Profile"
                        icon={<UserCog size={24} />}
                    />
                    <ProfileButton
                        onPress={() => router.push('/friends')}
                        label="Friends"
                        icon={<Users size={24} />}
                        number={3}
                    />
                    <ProfileButton
                        label="Stats"
                        icon={<BarChart3 size={24} />}
                        onPress={() => router.push('/stats')}
                    />
                    <ProfileButton
                        label="Settings"
                        icon={<Settings size={24} />}
                        onPress={() => console.log('Settings')}
                    />
                    <ProfileButton
                        label="Support"
                        icon={<HelpCircle size={24} />}
                        onPress={() => router.push('/profile/support')}
                    />
                </View>

                <View className="mt-8">
                    <ProfileButton
                        label="Logout"
                        icon={<LogOut size={24} />}
                        onPress={handleLogout}
                        danger
                    />
                </View>
            </ScrollView>
        </View>
    );
}
