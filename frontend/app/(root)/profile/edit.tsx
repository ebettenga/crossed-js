import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser, useUpdateUser, useUpdatePhoto } from '~/hooks/users';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export default function EditProfile() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { data: user } = useUser();
    const updateUser = useUpdateUser();
    const updatePhoto = useUpdatePhoto();
    const [username, setUsername] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await updateUser.mutateAsync({
                username: username !== user?.username ? username : undefined,
                email: email !== user?.email ? email : undefined,
            });
            router.back();
        } catch (error) {
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to update profile'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhotoUpload = async () => {
        try {
            // Request permissions
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please grant access to your photo library to upload a photo.');
                return;
            }

            // Pick image
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
                // Compress the image using the non-deprecated API
                const manipulateResult = await manipulateAsync(
                    result.assets[0].uri,
                    [{ resize: { width: 800, height: 800 } }],
                    { compress: 0.5, format: SaveFormat.JPEG }
                );

                const formData = new FormData();
                formData.append('photo', {
                    uri: manipulateResult.uri,
                    type: 'image/jpeg',
                    name: 'photo.jpg',
                } as any);

                try {
                    await updatePhoto.mutateAsync(formData);
                } catch (uploadError: any) {
                    if (uploadError?.message?.includes('File too large')) {
                        Alert.alert(
                            'Error',
                            'The image file is too large. Please choose a smaller image or try again with a more compressed version.'
                        );
                    } else {
                        throw uploadError;
                    }
                }
            }
        } catch (error) {
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to upload photo'
            );
        }
    };

    if (!user) return null;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <ChevronLeft size={24} color="#2B2B2B" />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Edit Profile</Text>
            </View>

            <View style={styles.form}>
                <TouchableOpacity 
                    style={styles.photoContainer}
                    onPress={handlePhotoUpload}
                >
                    {user.photo ? (
                        <Image 
                            source={{ uri: user.photo }} 
                            style={styles.photo}
                        />
                    ) : (
                        <View style={styles.photoPlaceholder}>
                            <Camera size={32} color="#666666" />
                        </View>
                    )}
                    <Text style={styles.photoText}>Change Photo</Text>
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter username"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter email"
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <TouchableOpacity 
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    backText: {
        fontSize: 16,
        color: '#2B2B2B',
        marginLeft: 4,
        fontFamily: 'Times New Roman',
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    form: {
        padding: 16,
        gap: 24,
    },
    photoContainer: {
        alignItems: 'center',
        gap: 8,
    },
    photo: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F8F8F5',
    },
    photoPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F8F8F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderStyle: 'dashed',
    },
    photoText: {
        fontSize: 16,
        color: '#8B0000',
        fontFamily: 'Times New Roman',
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 16,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    input: {
        height: 46,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F8F8F5',
        fontSize: 16,
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    saveButton: {
        backgroundColor: '#8B0000',
        height: 46,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Times New Roman',
    },
}); 