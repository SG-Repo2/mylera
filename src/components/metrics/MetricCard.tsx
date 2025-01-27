import { View, Text, Pressable } from 'react-native';
import tw from 'twrnc';

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
    <Pressable onPress={onPress} style={tw`bg-primary rounded-xl p-4 m-2`}>
      <View style={tw`flex-row justify-between mb-3`}>
        <Text style={tw`text-white font-medium`}>{title}</Text>
        <Text style={tw`text-white/70 text-sm`}>{points} pts</Text>
      </View>

      <View>
        <View style={tw`flex-row items-baseline space-x-1 mb-2`}>
          <Text style={tw`text-white text-2xl font-bold`}>
            {value.toLocaleString()}
          </Text>
          <Text style={tw`text-white text-base`}>{unit}</Text>
        </View>

        <View style={tw`bg-white/20 w-full h-2 rounded-full`}>
          <View
            style={[
              tw`bg-white h-full rounded-full`,
              { width: `${progress}%` },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}