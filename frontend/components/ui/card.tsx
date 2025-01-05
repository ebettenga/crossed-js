import { View } from 'react-native';

export function Card({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View className={`rounded-lg border-primary bg-background ${className || ''}`}>
      {children}
    </View>
  );
}
