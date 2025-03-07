import { isValidMetricValue, METRIC_VALIDATION } from '../healthMetricUtils';

describe('healthMetricUtils', () => {
  describe('isValidMetricValue', () => {
    it('should return false for non-numeric values', () => {
      expect(isValidMetricValue(NaN, 'steps')).toBe(false);
      expect(isValidMetricValue(Infinity, 'steps')).toBe(false);
      // @ts-ignore - Testing with invalid type
      expect(isValidMetricValue('100', 'steps')).toBe(false);
      // @ts-ignore - Testing with invalid type
      expect(isValidMetricValue(null, 'steps')).toBe(false);
      // @ts-ignore - Testing with invalid type
      expect(isValidMetricValue(undefined, 'steps')).toBe(false);
    });

    it('should validate steps within reasonable range', () => {
      expect(isValidMetricValue(0, 'steps')).toBe(true);
      expect(isValidMetricValue(1000, 'steps')).toBe(true);
      expect(isValidMetricValue(10000, 'steps')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.STEPS.MAX, 'steps')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.STEPS.MAX + 1, 'steps')).toBe(false);
      expect(isValidMetricValue(-1, 'steps')).toBe(false);
    });

    it('should validate distance within reasonable range', () => {
      expect(isValidMetricValue(0, 'distance')).toBe(true);
      expect(isValidMetricValue(1000, 'distance')).toBe(true); // 1km
      expect(isValidMetricValue(10000, 'distance')).toBe(true); // 10km
      expect(isValidMetricValue(METRIC_VALIDATION.DISTANCE.MAX, 'distance')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.DISTANCE.MAX + 1, 'distance')).toBe(false);
      expect(isValidMetricValue(-1, 'distance')).toBe(false);
    });

    it('should validate calories within reasonable range', () => {
      expect(isValidMetricValue(0, 'calories')).toBe(true);
      expect(isValidMetricValue(500, 'calories')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.CALORIES.MAX, 'calories')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.CALORIES.MAX + 1, 'calories')).toBe(false);
      expect(isValidMetricValue(-1, 'calories')).toBe(false);
    });

    it('should validate heart rate within reasonable range', () => {
      expect(isValidMetricValue(METRIC_VALIDATION.HEART_RATE.MIN, 'heart_rate')).toBe(true);
      expect(isValidMetricValue(70, 'heart_rate')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.HEART_RATE.MAX, 'heart_rate')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.HEART_RATE.MIN - 1, 'heart_rate')).toBe(false);
      expect(isValidMetricValue(METRIC_VALIDATION.HEART_RATE.MAX + 1, 'heart_rate')).toBe(false);
    });

    it('should validate exercise minutes within reasonable range', () => {
      expect(isValidMetricValue(0, 'exercise')).toBe(true);
      expect(isValidMetricValue(30, 'exercise')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.EXERCISE.MAX, 'exercise')).toBe(true); // 24 hours in minutes
      expect(isValidMetricValue(METRIC_VALIDATION.EXERCISE.MAX + 1, 'exercise')).toBe(false);
      expect(isValidMetricValue(-1, 'exercise')).toBe(false);
    });

    it('should validate basal calories within reasonable range', () => {
      expect(isValidMetricValue(0, 'basal_calories')).toBe(true);
      expect(isValidMetricValue(1800, 'basal_calories')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.BASAL_CALORIES.MAX, 'basal_calories')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.BASAL_CALORIES.MAX + 1, 'basal_calories')).toBe(false);
      expect(isValidMetricValue(-1, 'basal_calories')).toBe(false);
    });

    it('should validate flights climbed within reasonable range', () => {
      expect(isValidMetricValue(0, 'flights_climbed')).toBe(true);
      expect(isValidMetricValue(10, 'flights_climbed')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.FLIGHTS_CLIMBED.MAX, 'flights_climbed')).toBe(true);
      expect(isValidMetricValue(METRIC_VALIDATION.FLIGHTS_CLIMBED.MAX + 1, 'flights_climbed')).toBe(false);
      expect(isValidMetricValue(-1, 'flights_climbed')).toBe(false);
    });

    it('should default to non-negative validation for unknown metric types', () => {
      expect(isValidMetricValue(0, 'unknown_metric')).toBe(true);
      expect(isValidMetricValue(100, 'unknown_metric')).toBe(true);
      expect(isValidMetricValue(-1, 'unknown_metric')).toBe(false);
    });
  });
}); 