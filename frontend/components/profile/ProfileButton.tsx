import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { cn } from '~/lib/utils';
import { useColorMode } from '~/hooks/useColorMode';

interface ProfileButtonProps {
    label: string;
    icon: React.ReactNode;
    onPress?: () => void;
    number?: number;
    danger?: boolean;
}

export const ProfileButton: React.FC<ProfileButtonProps> = ({
    label,
    icon,
    onPress,
    number,
    danger = false
}) => {
    const { isDark } = useColorMode();

    return (
        <TouchableOpacity
            className={cn(
                "w-full h-14 bg-neutral-50 dark:bg-neutral-800 flex-row items-center justify-between px-4",
                "border-b border-neutral-200 dark:border-neutral-700",
                danger && "bg-red-50 dark:bg-red-900/20"
            )}
            onPress={onPress}
        >
            <View className="flex-row items-center gap-3">
                {number !== undefined && (
                    <Text className={cn(
                        "absolute -top-2 -left-2 text-xs font-['Times_New_Roman']",
                        danger ? "text-[#8B0000] dark:text-red-400" : "text-[#666666] dark:text-neutral-400"
                    )}>
                        {number}
                    </Text>
                )}
                <View className="w-6 items-center">
                    {React.cloneElement(icon as React.ReactElement, {
                        color: danger
                            ? (isDark ? '#EF4444' : '#8B0000')
                            : (isDark ? '#DDE1E5' : '#9CA3AF')
                    })}
                </View>
                <Text className={cn(
                    "text-base font-['Times_New_Roman']",
                    danger ? "text-[#8B0000] dark:text-red-400" : "text-[#1D2124] dark:text-[#DDE1E5]"
                )}>
                    {label}
                </Text>
            </View>
            <ChevronRight
                size={20}
                color={isDark ? '#9CA3AF' : '#666666'}
            />
        </TouchableOpacity>
    );
};
