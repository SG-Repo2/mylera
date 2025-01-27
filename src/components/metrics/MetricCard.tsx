import { View, Text, Pressable } from 'react-native';
import { styled } from 'nativewind';

const SView = styled(View);
const SText = styled(Text);
const SPressable = styled(Pressable);

interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  unit: string;
  onPress?: () => void;
}

export function MetricCard({ title, value, goal, points, unit, onPress }: MetricCardProps) {
  const progress = Math.min((value / goal) * 100, 100);

  return (
    <SPressable onPress={onPress} className="bg-primary rounded-xl p-4 m-2">
      <SView className="flex-row justify-between mb-3">
        <SText className="text-white font-medium">{title}</SText>
        <SText className="text-white/70 text-sm">{points} pts</SText>
      </SView>

      <SView>
        <SView className="flex-row items-baseline space-x-1 mb-2">
          <SText className="text-white text-2xl font-bold">
            {value.toLocaleString()}
          </SText>
          <SText className="text-white text-base">{unit}</SText>
        </SView>

        <SView className="bg-white/20 w-full h-2 rounded-full">
          <SView
            className="bg-white h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </SView>
      </SView>
    </SPressable>
  );
}