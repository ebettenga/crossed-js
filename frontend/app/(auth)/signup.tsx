import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '~/components/ui/text';
import { useSignUp } from '~/hooks/users';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignUp() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const signUpMutation = useSignUp();

    const handleSignUp = () => {
        try {
            setError('');
            signUpMutation.mutate(
                { email, password, username },
                {
                    onError: (err: any) => {
                        if (err) {
                            if (err.toString().includes('email-already-exists')) {
                                setError('This email is already registered');
                            } else if (err.toString().includes('username-already-exists')) {
                                setError('This username is already taken');
                            } else {
                                setError('Failed to create account');
                            }
                        } else {
                            setError('Failed to create account');
                        }
                    }
                }
            );
        } catch (err) {
            console.log(err);
            setError('Failed to create account');
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            enabled={true}
        >
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
                scrollEnabled={true}
                keyboardDismissMode="interactive"
            >
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

                <View className="flex-1 px-6 pt-8 pb-12">
                    <View className="mb-8">
                        <Text className="text-2xl font-bold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                            Create Account
                        </Text>
                        <Text className="text-base text-[#1D2124]/70 dark:text-[#DDE1E5]/70">
                            Sign up to start playing
                        </Text>
                    </View>

                    <View>
                        <View>
                            <Text className="text-sm font-semibold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                                Username
                            </Text>
                            <TextInput
                                className="p-4 border placeholder:text-[#1D2124]/50 dark:placeholder:text-[#DDE1E5]/50 bg-white border-[#E5E5E5] text-[#1D2124] dark:bg-[#1A2227] dark:border-[#2A3136] dark:text-[#DDE1E5]"
                                placeholder="Choose a username"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                            />
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-semibold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                                Email
                            </Text>
                            <TextInput
                                className="p-4 border placeholder:text-[#1D2124]/50 dark:placeholder:text-[#DDE1E5]/50 bg-white border-[#E5E5E5] text-[#1D2124] dark:bg-[#1A2227] dark:border-[#2A3136] dark:text-[#DDE1E5]"
                                placeholder="Enter your email"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View className="mt-4">
                            <Text className="text-sm font-semibold mb-2 text-[#1D2124] dark:text-[#DDE1E5]">
                                Password
                            </Text>
                            <TextInput
                                autoCapitalize="none"
                                className="p-4 border placeholder:text-[#1D2124]/50 dark:placeholder:text-[#DDE1E5]/50 bg-white border-[#E5E5E5] text-[#1D2124] dark:bg-[#1A2227] dark:border-[#2A3136] dark:text-[#DDE1E5]"
                                placeholder="Choose a password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        {error ? (
                            <Text className="text-red-500 text-center mt-4">
                                {error}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            className="bg-[#8B0000] p-4 mt-12"
                            onPress={handleSignUp}
                            disabled={signUpMutation.isPending}
                        >
                            <Text className="text-white text-center font-semibold text-base">
                                {signUpMutation.isPending ? 'Creating Account...' : 'Create Account'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            className="p-3"
                            onPress={() => router.push('/')}
                        >
                            <Text className="text-[#8B0000] text-center text-sm">
                                Already have an account? Sign in
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View className="h-[300px]" />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
