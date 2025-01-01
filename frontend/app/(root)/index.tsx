import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '~/components/ui/text';
import { useSignIn } from '~/hooks/users';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCrosswords } from '~/hooks/crosswords';

export default function SignIn() {
    const router = useRouter();

    const {data} = useCrosswords();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    const signInMutation = useSignIn();

    const handleSignIn = async () => {
        try {
            setError('');
            await signInMutation.mutate({ email, password }, {
                onSuccess: () => {
                    router.push('/(root)/(tabs)');
                }
            });
        } catch (err) {
            console.log(err);
            setError('Invalid email or password');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue playing</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity 
                        style={styles.signInButton}
                        onPress={handleSignIn}
                        disabled={signInMutation.isPending}
                    >
                        <Text style={styles.signInButtonText}>
                            {signInMutation.isPending ? 'Signing in...' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.createAccountButton}
                        onPress={() => router.push('/(auth)/signup')}
                    >
                        <Text style={styles.createAccountText}>
                            Don't have an account? Create one
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FDFDFD',
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#2B2B2B',
        paddingTop: 12,
        marginBottom: 8,
        fontFamily: 'Times New Roman',
    },
    subtitle: {
        fontSize: 16,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    form: {
        gap: 20,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: 'white',
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
        textAlign: 'center',
    },
    signInButton: {
        backgroundColor: '#059669',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    signInButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    createAccountButton: {
        padding: 12,
        alignItems: 'center',
    },
    createAccountText: {
        color: '#059669',
        fontSize: 14,
        fontWeight: '500',
    },
}); 