import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '~/components/ui/text';
import { useSignIn } from '~/hooks/users';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '~/hooks/users';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignIn() {
    const router = useRouter();
    const [credential, setCredential] = useState('');
    const [password, setPassword] = useState('');

    const signInMutation = useSignIn();
    const { isLoading: isLoadingUser } = useUser();

    const handleSignIn = () => {
        signInMutation.mutate({ credential, password });
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
            <View className="relative h-[40%]">
                <Image
                    source={require('~/assets/images/signin-background.jpg')}
                    className="absolute w-full h-full"
                    resizeMode="cover"
                />
                <LinearGradient
                    colors={['transparent', '#F6FAFE']}
                    className="absolute bottom-0 w-full h-1/2 dark:hidden"
                />
                <LinearGradient
                    colors={['transparent', '#0F1417']}
                    className="absolute bottom-0 w-full h-1/2 hidden dark:flex"
                />
                <Image
                    source={require('~/assets/images/icon-clean.png')}
                    className="absolute bottom-5 w-36 h-36 self-center"
                    resizeMode="contain"
                />
            </View>

            <View className="flex-1 px-6 pt-8">
                <View className="mb-8">
                    <Text className="text-2xl font-bold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                        Welcome Back
                    </Text>
                    <Text className="text-base text-[#1D2124]/70 dark:text-[#DDE1E5]/70">
                        Sign in to continue playing
                    </Text>
                </View>

                <View>
                    <View>
                        <Text className="text-sm font-semibold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                            Email or Username
                        </Text>
                        <TextInput
                            className="p-4 border placeholder:text-[#1D2124]/50 dark:placeholder:text-[#DDE1E5]/50 bg-white border-[#E5E5E5] text-[#1D2124] dark:bg-[#1A2227] dark:border-[#2A3136] dark:text-[#DDE1E5]"
                            placeholder="Enter your email or username"
                            value={credential}
                            onChangeText={setCredential}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View className="mt-4">
                        <Text className="text-sm font-semibold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                            Password
                        </Text>
                        <TextInput
                            autoCapitalize='none'
                            className="p-4 border placeholder:text-[#1D2124]/50 dark:placeholder:text-[#DDE1E5]/50 bg-white border-[#E5E5E5] text-[#1D2124] dark:bg-[#1A2227] dark:border-[#2A3136] dark:text-[#DDE1E5]"
                            placeholder="Enter your password"
                            placeholderTextColor="#1D2124/50 dark:#DDE1E5/50"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        className="bg-[#8B0000] p-4 mt-12"
                        onPress={handleSignIn}
                        disabled={signInMutation.isPending}
                    >
                        <Text className="text-white text-center font-semibold text-base">
                            {signInMutation.isPending || isLoadingUser ? 'Signing in...' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="p-3"
                        onPress={() => router.push('/(auth)/signup')}
                    >
                        <Text className="text-[#8B0000] text-center text-sm">
                            Don't have an account? Create one
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
