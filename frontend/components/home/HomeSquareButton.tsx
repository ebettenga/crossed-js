import React from 'react';
import { Text, View, Pressable, useColorScheme } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { cn } from '~/lib/utils';

interface IconProps {
    size?: number;
    color?: string;
}

interface HomeSquareButtonProps {
    name?: string;
    icon?: React.ReactElement<IconProps>;
    onPress: () => void;
    size?: number;
    number?: number;
    customStyle?: {
        wrapper?: string;
        container?: string;
        pressed?: string;
    };
    iconColor?: string;
    darkIconColor?: string;
}

export const HomeSquareButton: React.FC<HomeSquareButtonProps> = ({
    name,
    icon,
    onPress,
    size = 120,
    number,
    customStyle,
    iconColor = "#2B2B2B",
    darkIconColor = "#E5E5E5"
}) => {
    const colorScheme = useColorScheme();

    // Clone the icon element with dark mode color if it exists
    const themedIcon = icon
        ? React.cloneElement(icon, {
            color: colorScheme === 'dark' ? darkIconColor : iconColor
          })
        : null;

    return (
        <View
            style={{ width: size, height: size }}
            className={cn(
                "border-[1.5px] border-[#343434] dark:border-neutral-600 bg-[#FAFAF7] dark:bg-neutral-800",
                customStyle?.wrapper
            )}
        >
            <Pressable
                onPress={onPress}
                style={({ pressed }) => ({
                    backgroundColor: pressed
                        ? '#F0F0ED'
                        : '#FAFAF7'
                })}
                className={cn(
                    "flex-1 justify-center items-center relative dark:bg-neutral-800",
                    "active:bg-[#F0F0ED] active:dark:bg-neutral-700",
                    customStyle?.container
                )}
            >
                {number !== undefined && (
                    <Text className="absolute top-1 left-1 text-xs font-['Times_New_Roman'] text-[#666666] dark:text-neutral-400 font-medium">
                        {number}
                    </Text>
                )}
                <View className="w-full h-full flex flex-col items-center justify-center">
                    {themedIcon && (
                        <View className="mb-1">
                            {themedIcon}
                        </View>
                    )}
                    {name && (
                        <Text className="text-[#2B2B2B] dark:text-neutral-200 text-base font-['Times_New_Roman'] text-center px-1">
                            {name}
                        </Text>
                    )}
                </View>
            </Pressable>
        </View>
    );
};
