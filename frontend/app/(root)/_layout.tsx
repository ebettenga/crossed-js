import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalContext } from "@/lib/global-provider";
import { ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useUser } from '~/hooks/users';

export default function RootLayout() {
  const { loading: globalLoading, isLoggedIn: globalIsLoggedIn } = useGlobalContext();
  const {data: user, isLoading: userLoading} = useUser();

  const loading = globalLoading || userLoading;
  const isLoggedIn = globalIsLoggedIn || !!user;

  if (!user && !loading) {
    return <Redirect href="/(auth)/signin" />;
  }

  if (loading) {
    return (
      <SafeAreaView className="bg-white h-full flex justify-center items-center">
        <ActivityIndicator className="text-primary-300" size="large" />
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) return <Redirect href="/(auth)/signin" />;

  return (
    <SafeAreaView className="bg-white h-full">
      <Slot />
    </SafeAreaView>
  );
}