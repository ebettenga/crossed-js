import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, useColorScheme, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import { PageHeader } from '~/components/Header';
import { useSupport, useCreateSupport, FeedbackType } from '~/hooks/support';

export default function Support() {
    const router = useRouter();
    const isDarkMode = useColorScheme() === 'dark';
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<FeedbackType>('support');
    const [comment, setComment] = useState('');

    const { data: supportRequests } = useSupport();
    const createSupport = useCreateSupport();

    const handleSubmit = () => {
        if (!comment.trim()) {
            Alert.alert('Error', 'Please enter a comment');
            return;
        }

        createSupport.mutate(
            {
                type: selectedType,
                comment: comment.trim()
            },
            {
                onSuccess: () => {
                    Alert.alert('Success', 'Your request has been submitted successfully.');
                    router.back();
                },
                onError: (error: any) => {
                    Alert.alert('Error', error?.response?.data?.error || 'Failed to submit request');
                }
            }
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-[#0F1417]">
            <PageHeader />

            <TouchableOpacity
                className="flex-row items-center px-4 py-3"
                onPress={() => router.back()}
            >
                <ChevronLeft size={24} color={isDarkMode ? '#DDE1E5' : '#2B2B2B'} />
                <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] ml-1 font-['Times New Roman']">
                    Back
                </Text>
            </TouchableOpacity>

            <View className="p-4 gap-6">
                <View className="gap-2">
                    <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        Type
                    </Text>
                    <View className="relative">
                        <TouchableOpacity
                            className="h-[46px] border border-[#E5E5E5] dark:border-[#2A3136] rounded-lg px-3 bg-[#F8F8F5] dark:bg-[#1A2227] flex-row items-center justify-between"
                            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                                {selectedType === 'support' ? 'Support Request' : 'Suggestion'}
                            </Text>
                            <ChevronDown size={20} color={isDarkMode ? '#DDE1E5' : '#2B2B2B'} />
                        </TouchableOpacity>

                        {isDropdownOpen && (
                            <View className="absolute top-[46px] left-0 right-0 border border-[#E5E5E5] dark:border-[#2A3136] rounded-lg bg-[#F8F8F5] dark:bg-[#1A2227] z-10">
                                <TouchableOpacity
                                    className="p-3 border-b border-[#E5E5E5] dark:border-[#2A3136]"
                                    onPress={() => {
                                        setSelectedType('support');
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                                        Support Request
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="p-3"
                                    onPress={() => {
                                        setSelectedType('suggestion');
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                                        Suggestion
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                <View className="gap-2">
                    <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                        Comment
                    </Text>
                    <TextInput
                        className="min-h-[120px] p-3 border border-[#E5E5E5] dark:border-[#2A3136] rounded-lg bg-[#F8F8F5] dark:bg-[#1A2227] text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']"
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Enter your comment here..."
                        placeholderTextColor="#666666"
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                <TouchableOpacity
                    className="bg-[#8B0000] h-[46px] rounded-lg items-center justify-center"
                    onPress={handleSubmit}
                    disabled={createSupport.isPending}
                >
                    <Text className="text-white text-base font-semibold font-['Times New Roman']">
                        {createSupport.isPending ? 'Submitting...' : 'Submit'}
                    </Text>
                </TouchableOpacity>

                {supportRequests && supportRequests.length > 0 && (
                    <View className="gap-2">
                        <Text className="text-base text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                            Previous Requests
                        </Text>
                        <View className="gap-2">
                            {supportRequests.map((request) => (
                                <View
                                    key={request.id}
                                    className="p-3 border border-[#E5E5E5] dark:border-[#2A3136] rounded-lg bg-[#F8F8F5] dark:bg-[#1A2227]"
                                >
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-sm text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman'] capitalize">
                                            {request.type}
                                        </Text>
                                        <Text className="text-xs text-[#666666] dark:text-[#DDE1E5]/70 font-['Times New Roman']">
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Text className="text-base text-[#2B2B2B] dark:text-[#DDE1E5] font-['Times New Roman']">
                                        {request.comment}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
