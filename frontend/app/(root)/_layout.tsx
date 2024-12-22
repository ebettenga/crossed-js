import { useGlobalContext } from "@/lib/global-provider";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, Slot } from "expo-router";
import { useCrosswords } from "@/hooks/crosswords";
import { config } from "@/config/config";

export default function AppLayout() {
    const { loading, isLoggedIn } = useGlobalContext();
    const { data: crosswords, isLoading: crosswordsLoading } = useCrosswords();

    console.log(crosswords);

    if (loading || crosswordsLoading) {
        return (
            <SafeAreaView className="bg-white h-full flex justify-center items-center">
                <ActivityIndicator className="text-primary-300" size="large" />
            </SafeAreaView>
        )
    }

    if (!isLoggedIn) return <Redirect href='/sign-in' />

    return (
        <SafeAreaView className="bg-white h-full">
            <Slot />
            <View>
                {crosswords?.map((crossword: any, index: number) => (
                    <Text key={index}>{crossword.title}</Text>
                ))}
            </View>
        </SafeAreaView>
    );
}