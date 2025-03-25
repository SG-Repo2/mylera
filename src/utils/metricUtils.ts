import { MetricType, MeasurementSystem } from '../types/metrics';

export const getYAxisConfig = (
  metricType: MetricType,
  maxValue: number,
  measurementSystem: MeasurementSystem
): { yMin: number; yMax: number; tickValues: number[] } => {
  const MIN_TICK_COUNT = 5;
  let yMin = 0;
  let yMax = maxValue;
  let tickValues: number[] = [];

  switch (metricType) {
    case 'steps':
      if (maxValue <= 1000) yMax = Math.ceil(maxValue / 200) * 200;
      else if (maxValue <= 5000) yMax = Math.ceil(maxValue / 1000) * 1000;
      else if (maxValue <= 10000) yMax = Math.ceil(maxValue / 2000) * 2000;
      else yMax = Math.ceil(maxValue / 5000) * 5000;

      const stepInterval = yMax / (MIN_TICK_COUNT - 1);
      tickValues = Array.from({ length: MIN_TICK_COUNT }, (_, i) => Math.round(i * stepInterval));
      break;

    case 'distance':
      const convertedValue = convertMetricValue(maxValue, metricType, measurementSystem);
      let displayMax = Math.ceil(convertedValue / 0.5) * 0.5;
      if (displayMax < 0.5) displayMax = 0.5;

      const tickCount = Math.max(Math.ceil(displayMax / 0.5) + 1, MIN_TICK_COUNT);
      const displayTicks = Array.from({ length: tickCount }, (_, i) => i * 0.5);

      yMax = convertToInternalUnits(displayMax, metricType, measurementSystem);
      tickValues = displayTicks.map(v => convertToInternalUnits(v, metricType, measurementSystem));
      break;

    // Handle other metric types with their specific logic
    default:
      yMax = Math.ceil(maxValue * 1.1);
      const interval = yMax / (MIN_TICK_COUNT - 1);
      tickValues = Array.from({ length: MIN_TICK_COUNT }, (_, i) => Math.round(i * interval));
      break;
  }

  return { yMin, yMax, tickValues };
};

export const formatTickValue = (
  value: number,
  metricType: MetricType,
  measurementSystem: MeasurementSystem
): string => {
  switch (metricType) {
    case 'steps':
      return value >= 10000 ? `${(value / 1000).toFixed(1)}k` : value.toString();
    case 'distance':
      const displayValue = convertMetricValue(value, metricType, measurementSystem);
      return displayValue.toFixed(1) + (measurementSystem === 'imperial' ? 'mi' : 'km');
    default:
      return value.toString();
  }
};

export const convertMetricValue = (
  value: number,
  metricType: MetricType,
  measurementSystem: MeasurementSystem
): number => {
  if (metricType === 'distance') {
    return measurementSystem === 'imperial'
      ? value / 1609.34 // meters to miles
      : value / 1000; // meters to kilometers
  }
  return value;
};

export const convertToInternalUnits = (
  value: number,
  metricType: MetricType,
  measurementSystem: MeasurementSystem
): number => {
  if (metricType === 'distance') {
    return measurementSystem === 'imperial'
      ? value * 1609.34 // miles to meters
      : value * 1000; // kilometers to meters
  }
  return value;
};
