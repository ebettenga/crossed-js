import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Text } from '~/components/ui/text';
import { useSignUp, useUser } from '~/hooks/users';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUp() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const { data: user } = useUser();  
    
    const signUpMutation = useSignUp();

    const handleSignUp = () => {
        try {
            setError('');
            signUpMutation.mutate({ email, password, username });
        } catch (err) {
            console.log(err);
            setError('Failed to create account');
        }
    };

    if (user) {
        return <Redirect href="/(root)/(tabs)" />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Sign up to start playing</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Choose a username"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

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
                            placeholder="Choose a password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity 
                        style={styles.signUpButton}
                        onPress={handleSignUp}
                        disabled={signUpMutation.isPending}
                    >
                        <Text style={styles.signUpButtonText}>
                            {signUpMutation.isPending ? 'Creating Account...' : 'Create Account'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.signInButton}
                        onPress={() => router.push('/')}
                    >
                        <Text style={styles.signInText}>
                            Already have an account? Sign in
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
    signUpButton: {
        backgroundColor: '#8B0000',
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
    signUpButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    signInButton: {
        padding: 12,
        alignItems: 'center',
    },
    signInText: {
        color: '#8B0000',
        fontSize: 14,
        fontWeight: '500',
    },
}); 