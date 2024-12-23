import { View, Text, ScrollView, Image, TouchableOpacity, ImageSourcePropType, Alert } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context";
import icons from "@/constants/icons";
import { settings } from "@/constants/data";
import { useGlobalContext } from "@/lib/global-provider";

interface SettingsItemProps {
    icon: ImageSourcePropType;
    title: string;
    onPress?: () => void;
    textStyle?: string;
    showArrow?: boolean;
}

const SettingsItem = ({ icon, title, onPress, textStyle, showArrow = true }: SettingsItemProps) => (
    <TouchableOpacity onPress={onPress} className="flex flex-row items-center justify-between py-3">
    </TouchableOpacity>
)

const Profile = () => {
    const { user } = useGlobalContext();

    const handleLogout = async () => {
        const result = null // await logout();

        if (result) {
            Alert.alert("Success", "You have been logged out successfully");
            // refetch();
        } else {
            Alert.alert("Error", "An error occurred while logging out")
        }
    };

    return (
        <SafeAreaView className="h-full bg-white">

        </SafeAreaView>
    )
}
export default Profile
