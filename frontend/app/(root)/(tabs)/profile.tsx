import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Text } from '../../../components/ui/text';
import { useUser, useLogout } from '../../../hooks/users';
import { Image } from 'expo-image';
import { vars } from 'nativewind';
import { useColorScheme } from 'nativewind';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';


export default function Profile() {
  const { data: user, isLoading, error } = useUser();
  const logout = useLogout();
  const { colorScheme } = useColorScheme();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" className="text-[--color-text]" />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-[--color-text] text-lg">Error loading profile</Text>
        <Button onPress={logout} className="mt-4">
          Sign Out
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 px-4 py-6"

      contentContainerClassName="pb-20"
    >
      {/* Profile Header */}
      <View className="items-center mb-6">
        {user.photo ? (
          <Image
            source={{ uri: user.photo }}
            className="w-24 h-24 rounded-full mb-4"
            contentFit="cover"
          />
        ) : (
          <View className="w-24 h-24 rounded-full bg-[--color-card] items-center justify-center mb-4">
            <Text className="text-[--color-text] text-2xl">
              {user.username?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text className="text-black text-2xl font-bold mb-1">
          {user.username}
        </Text>
        <Text className="text-black opacity-60">
          {user.email}
        </Text>
      </View>

      {/* Stats Cards */}
      <View className="flex-row flex-wrap justify-between mb-6">
        <StatCard title="ELO Rating" value={user.eloRating.toString()} />
        <StatCard title="Win Rate" value={`${user.winRate}%`} />
        <StatCard title="Games Won" value={user.gamesWon.toString()} />
        <StatCard title="Games Lost" value={user.gamesLost.toString()} />
      </View>

      {/* Actions */}
      <View className="space-y-4">
        <Link href="/profile/edit" asChild>
          <Button className="w-full">
            Edit Profile
          </Button>
        </Link>
        <Button
          variant="destructive"
          className="w-full"
          onPress={logout}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="w-[48%] mb-4 bg-[--color-card] border-[--color-border]">
      <View className="p-4">
        <Text className="text-primary opacity-60 text-sm mb-1">
          {title}
        </Text>
        <Text className="text-[--color-text] text-xl font-bold">
          {value}
        </Text>
      </View>
    </Card>
  );
}
