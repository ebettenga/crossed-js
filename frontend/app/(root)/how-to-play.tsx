import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Users, Timer, Swords } from 'lucide-react-native';

import { HomeSquareButton } from '~/components/home/HomeSquareButton';
import { cn } from '~/lib/utils';
import { useColorMode } from '~/hooks/useColorMode';
import { secureStorage } from '~/hooks/storageApi';
import { useUser } from '~/hooks/users';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SlideKey = '1v1' | 'time_trial' | 'free_for_all';

type Slide = {
  key: SlideKey;
  title: string;
  description: string;
  number?: number;
  homeButtonLabel: string;
  secondaryText: string;
  icon: React.ReactElement;
};

const SLIDES: Slide[] = [
  {
    key: '1v1',
    title: '1 v 1 Duels',
    description:
      'Challenge a single opponent in a head-to-head crossword duel. Take turns solving clues and outsmart your rival.',
    number: 1,
    homeButtonLabel: '1 v 1',
    secondaryText: 'Classic duel action',
    icon: <Users size={28} />,
  },
  {
    key: 'time_trial',
    title: 'Time Trials',
    description:
      'Race against the clock in this single player mode to solve as many clues as possible. Every second counts and every guess matters.',
    number: undefined,
    homeButtonLabel: 'Time Trial',
    secondaryText: 'Beat the timer',
    icon: <Timer size={28} />,
  },
  {
    key: 'free_for_all',
    title: 'Free For All',
    description:
      'Jump into chaotic multiplayer puzzles with friends or rivals. Everyone works the same board—fastest solves win.',
    number: undefined,
    homeButtonLabel: 'Free for All',
    secondaryText: 'Group play frenzy',
    icon: <Swords size={28} />,
  },
];

export default function HowToPlay() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const { isDark } = useColorMode();
  const { data: user } = useUser();

  useEffect(() => {
    if (!user) return;
    secureStorage.set(`how_to_play_seen_${user.id}`, 'true');
  }, [user]);

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const newIndex = Math.round(contentOffset.x / SCREEN_WIDTH);
    setActiveSlide(newIndex);
  };

  const handleNext = () => {
    if (activeSlide >= SLIDES.length - 1) {
      handleDone();
      return;
    }
    scrollRef.current?.scrollTo({
      x: (activeSlide + 1) * SCREEN_WIDTH,
      animated: true,
    });
    setActiveSlide((prev) => Math.min(prev + 1, SLIDES.length - 1));
  };

  const handleDone = () => {
    if (user) {
      secureStorage.set(`how_to_play_seen_${user.id}`, 'true');
    }
    if (source === 'login') {
      router.replace('/(root)/(tabs)');
    } else {
      router.back();
    }
  };

  const actionLabel = activeSlide === SLIDES.length - 1 ? 'Get Started' : 'Next';

  return (
    <View className={cn('flex-1', isDark ? 'bg-[#0F1417]' : 'bg-[#F6FAFE]')}>
      <View className="px-6 pt-16 pb-8">
        <Text className={cn(
          'text-3xl font-semibold font-rubik-medium',
          isDark ? 'text-[#F6FAFE]' : 'text-[#0F1417]',
        )}>
          How to Play
        </Text>
        <Text className={cn(
          'mt-2 text-base font-rubik',
          isDark ? 'text-neutral-300' : 'text-neutral-600',
        )}>
          Learn what each mode does before you dive in.
        </Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        ref={scrollRef}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {SLIDES.map((slide) => (
          <View
            key={slide.key}
            style={{ width: SCREEN_WIDTH }}
            className="px-6"
          >
            <View className="rounded-3xl border border-[#D3D3D3] dark:border-neutral-700 bg-white dark:bg-[#1A2227] py-8 px-6 min-h-[420px] justify-between">
              <View>
                <Text className={cn(
                  'text-2xl font-semibold font-rubik-medium',
                  isDark ? 'text-[#F6FAFE]' : 'text-[#0F1417]'
                )}>
                  {slide.title}
                </Text>
                <Text className={cn(
                  'mt-3 text-base leading-6 font-rubik',
                  isDark ? 'text-neutral-300' : 'text-neutral-700'
                )}>
                  {slide.description}
                </Text>
              </View>

              <View className="items-center gap-4">
                <HomeSquareButton
                  name={slide.homeButtonLabel}
                  icon={slide.icon}
                  number={slide.number}
                  onPress={() => { }}
                  size={140}
                  customStyle={{
                    wrapper: 'shadow-sm shadow-black/10',
                  }}
                />
                <Text className={cn(
                  'text-sm font-rubik',
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                )}>
                  {slide.secondaryText}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="items-center mt-8">
        <View className="flex-row gap-2">
          {SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              className={cn(
                'h-2 rounded-full',
                index === activeSlide ? 'w-6' : 'w-2',
                index === activeSlide
                  ? isDark ? 'bg-[#8B0000]' : 'bg-[#8B0000]'
                  : isDark ? 'bg-neutral-600' : 'bg-neutral-300'
              )}
            />
          ))}
        </View>
      </View>

      <View className="px-6 mt-12 mb-10">
        <TouchableOpacity
          onPress={handleNext}
          className={cn(
            'w-full py-4 rounded-xl items-center justify-center',
            'bg-[#8B0000]'
          )}
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-base font-rubik-medium">
            {actionLabel}
          </Text>
        </TouchableOpacity>

        {source === 'login' && activeSlide < SLIDES.length - 1 && (
          <TouchableOpacity
            onPress={handleDone}
            className="mt-4 items-center"
            activeOpacity={0.7}
          >
            <Text className={cn(
              'text-sm font-rubik-medium',
              isDark ? 'text-neutral-300' : 'text-neutral-600'
            )}>
              Skip for now
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
