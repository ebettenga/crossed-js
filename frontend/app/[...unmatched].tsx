import { View } from 'react-native';
import { Text } from '~/components/ui/text';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]">
      <View className="flex-1 p-5 justify-center items-center">
        <Text className="text-[32px] font-bold text-[#1D2124] dark:text-[#DDE1E5] mb-2 font-rubik">
          Oops!
        </Text>
        <Text className="text-lg text-[#666666] dark:text-[#DDE1E5]/70 mb-8 font-rubik">
          This page doesn't exist.
        </Text>

        <TouchableOpacity
          className="bg-[#8B0000] px-6 py-3 shadow-sm"
          onPress={() => router.replace('/(root)/(tabs)')}
        >
          <Text className="text-white text-base font-semibold">
            Go to Home
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
