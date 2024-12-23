import { useGlobalContext } from "@/lib/global-provider";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator } from "react-native";
import { Redirect, Slot } from "expo-router";
import { useCrosswords } from "@/hooks/crosswords";


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

    if (!isLoggedIn) return <Redirect href='./index' />

    return (
        <SafeAreaView className="bg-white h-full">
            <Slot />
        </SafeAreaView>
    );
}