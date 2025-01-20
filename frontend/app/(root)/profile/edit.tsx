import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, SafeAreaView, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser, useUpdateUser, useUpdatePhoto } from '~/hooks/users';
import { ChevronLeft, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { PageHeader } from '~/components/Header';
import { useColorMode } from '~/hooks/useColorMode';

export default function EditProfile() {
    const router = useRouter();
    const { data: user } = useUser();
    const updateUser = useUpdateUser();
    const updatePhoto = useUpdatePhoto();
    const [username, setUsername] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [isLoading, setIsLoading] = useState(false);
    const { isDark } = useColorMode();
    const [pendingPhoto, setPendingPhoto] = useState<{ uri: string, formData: FormData } | null>(null);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // First update photo if there's a pending one
            if (pendingPhoto) {
                await updatePhoto.mutateAsync(pendingPhoto.formData);
            }

            // Then update user details only if there are changes
            const hasUsernameChange = username !== user?.username;
            const hasEmailChange = email !== user?.email;

            if (hasUsernameChange || hasEmailChange) {
                await updateUser.mutateAsync({
                    username: hasUsernameChange ? username : undefined,
                    email: hasEmailChange ? email : undefined,
                });
            }

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
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please grant access to your photo library to upload a photo.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled) {
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

                // Store the photo data temporarily
                setPendingPhoto({
                    uri: manipulateResult.uri,
                    formData
                });
            }
        } catch (error) {
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to prepare photo'
            );
        }
    };

    if (!user) return null;

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0F1417]">
            <PageHeader />

            <TouchableOpacity
                className="flex-row items-center px-4 py-3"
                onPress={() => router.push('/profile')}
            >
                <ChevronLeft size={24} color={isDark ? '#DDE1E5' : '#2B2B2B'} />
                <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] ml-1 font-['Times New Roman']">
                    Back
                </Text>
            </TouchableOpacity>

            <View className="p-4 gap-6">
                <TouchableOpacity
                    className="items-center gap-2"
                    onPress={handlePhotoUpload}
                >
                    {pendingPhoto ? (
                        <Image
                            source={{ uri: pendingPhoto.uri }}
                            className="w-[120px] h-[120px] rounded-full bg-[#F8F8F5] dark:bg-[#1A2227]"
                        />
                    ) : user.photo ? (
                        <Image
                            source={{ uri: user.photo }}
                            className="w-[120px] h-[120px] rounded-full bg-[#F8F8F5] dark:bg-[#1A2227]"
                        />
                    ) : (
                        <View className="w-[120px] h-[120px] rounded-full bg-[#F8F8F5] dark:bg-[#1A2227] items-center justify-center border border-dashed border-[#E5E5E5] dark:border-[#2A3136]">
                            <Camera size={32} color="#666666" />
                        </View>
                    )}
                    <Text className="text-base text-[#8B0000] font-['Times New Roman']">
                        Change Photo
                    </Text>
                </TouchableOpacity>

                <View className="gap-2">
                    <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        Username
                    </Text>
                    <TextInput
                        className="h-[46px] border border-[#E5E5E5] dark:border-[#2A3136] rounded-lg px-3 bg-[#F8F8F5] dark:bg-[#1A2227] text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']"
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter username"
                        placeholderTextColor="#666666"
                        autoCapitalize="none"
                    />
                </View>

                <View className="gap-2">
                    <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        Email
                    </Text>
                    <TextInput
                        className="h-[46px] border border-[#E5E5E5] dark:border-[#2A3136] rounded-lg px-3 bg-[#F8F8F5] dark:bg-[#1A2227] text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter email"
                        placeholderTextColor="#666666"
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <TouchableOpacity
                    className="bg-[#8B0000] h-[46px] rounded-lg items-center justify-center"
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text className="text-white text-base font-semibold font-['Times New Roman']">
                            Save Changes
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
