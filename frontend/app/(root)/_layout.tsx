import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalContext } from "@/lib/global-provider";
import { ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";

export default function RootLayout() {
  const { loading, isLoggedIn } = useGlobalContext();

  if (loading) {
    return (
      <SafeAreaView className="bg-white h-full flex justify-center items-center">
        <ActivityIndicator className="text-primary-300" size="large" />
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) return <Redirect href="./index" />;

  return (
    <SafeAreaView className="bg-white h-full">
      <Slot />
    </SafeAreaView>
  );
}