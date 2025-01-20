import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { useCreateSupport, FeedbackType } from '~/hooks/support';
import { showToast } from '~/components/shared/Toast';
import { cn } from '~/lib/utils';
import { useColorMode } from '~/hooks/useColorMode';

interface SupportContentProps {
    onClose?: () => void;
    initialType?: FeedbackType;
    initialComment?: string;
    className?: string;
    header?: React.ReactNode;
}

export const SupportContent: React.FC<SupportContentProps> = ({
    onClose,
    initialType = 'support',
    initialComment = '',
    className,
    header,
}) => {
    const { isDark } = useColorMode();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<FeedbackType>(initialType);
    const [comment, setComment] = useState(initialComment);

    const createSupport = useCreateSupport();

    const handleSubmit = () => {
        if (!comment.trim()) {
            showToast('error', 'Please enter a comment');
            return;
        }

        createSupport.mutate(
            {
                type: selectedType,
                comment: comment.trim()
            },
            {
                onSuccess: () => {
                    showToast('success', 'Your request has been submitted successfully.');
                    if (onClose) onClose();
                },
                onError: (error: any) => {
                    showToast('error', error?.response?.data?.error || 'Failed to submit request');
                }
            }
        );
    };

    return (
        <ScrollView className={cn("bg-[#FFFFFF] rounded-md dark:bg-[#0F1417]", className)} contentContainerStyle={{ flexGrow: 0 }} >
            {header ? header :
                <View className="w-full relative py-6">
                    <Text className="text-xl text-center text-[#1D2124] dark:text-white font-semibold">
                        {selectedType === 'support' ? 'Support Request' : 'Suggestion'}
                    </Text>
                    {onClose && (
                        <TouchableOpacity
                            className="absolute right-3 top-4"
                            onPress={onClose}
                        >
                            <X size={20} className="text-[#666666] dark:text-[#DDE1E5]" />
                        </TouchableOpacity>
                    )}
                </View>
            }

            <View className="gap-y-6 p-4 flex justify-between">
                <View className="gap-2">
                    <Text className="text-base text-foreground font-semibold dark:text-white">
                        Type
                    </Text>
                    <View className="relative">
                        <TouchableOpacity
                            className="h-[46px] border border-border rounded-lg px-3 bg-[#F2F2F2] dark:bg-[#2A3136] flex-row items-center justify-between"
                            onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <Text className="text-base text-foreground dark:text-white ">
                                {selectedType === 'support' ? 'Support Request' : 'Suggestion'}
                            </Text>
                            <ChevronDown size={20} className="text-foreground dark:text-white" />
                        </TouchableOpacity>

                        {isDropdownOpen && (
                            <View className="absolute top-[46px] left-0 right-0 border border-border rounded-lg bg-[#F2F2F2] dark:bg-[#2A3136] z-10">
                                <TouchableOpacity
                                    className="p-3 border-b border-border"
                                    onPress={() => {
                                        setSelectedType('support');
                                        setIsDropdownOpen(false);
                                    }}
                                >
                                    <Text className="text-base dark:text-white ">
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
                                    <Text className="text-base dark:text-white ">
                                        Suggestion
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                <View className="gap-2">
                    <Text className="text-base text-foreground font-semibold dark:text-white">
                        Comment
                    </Text>
                    <TextInput
                        className="min-h-[120px] p-3 border border-border rounded-lg bg-[#F2F2F2] dark:bg-[#2A3136] text-base text-foreground dark:text-white "
                        value={comment}
                        onChangeText={setComment}
                        placeholder="Enter your comment here..."
                        placeholderTextColor={isDark ? '#9CA3AF' : '#333333'}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                <TouchableOpacity
                    className="bg-[#8B0000] h-[46px] rounded-lg items-center justify-center"
                    onPress={handleSubmit}
                    disabled={createSupport.isPending}
                >
                    <Text className="text-white text-base font-semibold ">
                        {createSupport.isPending ? 'Submitting...' : 'Submit'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};
