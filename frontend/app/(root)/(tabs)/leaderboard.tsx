import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '~/components/Header';
import { useGlobalLeaderboard } from '~/hooks/useLeaderboard';

type LeaderboardRowProps = {
  title: string;
  value: string;
  subtitle?: string;
  backgroundClassName?: string;
};

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ title, value, subtitle, backgroundClassName }) => (
  <View className={`flex-row items-center justify-between px-4 py-3 ${backgroundClassName ?? ''}`}>
    <View className="flex-1 pr-3">
      <Text numberOfLines={1} className="text-base font-rubik-medium text-[#1D2124] dark:text-[#DDE1E5]">
        {title}
      </Text>
      {subtitle ? (
        <Text numberOfLines={1} className="text-xs text-neutral-500 dark:text-neutral-400 font-rubik">
          {subtitle}
        </Text>
      ) : null}
    </View>
    <Text className="text-base font-rubik-medium text-[#1D2124] dark:text-[#DDE1E5]">
      {value}
    </Text>
  </View>
);

const LeaderboardSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="mb-6">
    <Text className="text-lg font-rubik-medium text-[#1D2124] dark:text-[#DDE1E5] mb-3">
      {title}
    </Text>
    <View className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {children}
    </View>
  </View>
);

const formatDuration = (timeTakenMs: number | null) => {
  if (timeTakenMs == null) {
    return '—';
  }
  const totalSeconds = Math.max(0, Math.floor(timeTakenMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const LeaderboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefetching, refetch } = useGlobalLeaderboard();

  const onRefresh = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6FAFE] dark:bg-[#0F1417]">
        <ActivityIndicator size="large" color="#8B0000" />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-[#F6FAFE] dark:bg-[#0F1417]"
      style={{ paddingBottom: insets.bottom }}
    >
      <PageHeader />
      <ScrollView
        className="flex-1 mt-4 px-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor="#8B0000"
            colors={["#8B0000"]}
          />
        }
      >
        <LeaderboardSection title="Top ELO">
          {data.topElo.length === 0 ? (
            <View className="px-4 py-6">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center font-rubik">
                No players ranked yet. Jump into a match to claim the leaderboard.
              </Text>
            </View>
          ) : (
            data.topElo.map((entry, index) => (
              <LeaderboardRow
                key={entry.user.id}
                title={entry.user.username || 'Anonymous'}
                value={`${entry.user.eloRating} ELO`}
                subtitle={entry.user.winRate != null ? `Win rate ${Math.round(entry.user.winRate)}%` : undefined}
                backgroundClassName={index % 2 === 0 ? 'bg-white dark:bg-[#181D21]' : 'bg-[#EFF3F6] dark:bg-[#14181C]'}
              />
            ))
          )}
        </LeaderboardSection>

        <LeaderboardSection title="Top Score (Time Trial)">
          {data.topTimeTrials.length === 0 ? (
            <View className="px-4 py-6">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 text-center font-rubik">
                Time trial results will appear here once games are completed.
              </Text>
            </View>
          ) : (
            data.topTimeTrials.map((entry, index) => (
              <LeaderboardRow
                key={`${entry.roomId}-${entry.rank}`}
                title={entry.user?.username || 'Anonymous'}
                value={`${entry.score} pts`}
                subtitle={
                  entry.timeTakenMs != null
                    ? `Time ${formatDuration(entry.timeTakenMs)}`
                    : undefined
                }
                backgroundClassName={index % 2 === 0 ? 'bg-white dark:bg-[#181D21]' : 'bg-[#EFF3F6] dark:bg-[#14181C]'}
              />
            ))
          )}
        </LeaderboardSection>
        <View className='mb-20' />
      </ScrollView>
    </View>
  );
};

export default LeaderboardScreen;
