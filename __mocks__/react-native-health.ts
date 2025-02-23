const mockAppleHealthKit = {
  initHealthKit: jest.fn().mockResolvedValue(true),
  getStepCount: jest.fn().mockResolvedValue({ value: 1000 }),
  getDistanceWalking: jest.fn().mockResolvedValue({ value: 1.5 }),
  getActiveEnergyBurned: jest.fn().mockResolvedValue({ value: 500 }),
  getHeartRateSamples: jest.fn().mockResolvedValue([{ value: 75 }]),
  getFlightsClimbed: jest.fn().mockResolvedValue({ value: 10 }),
  getAppleExerciseTime: jest.fn().mockResolvedValue({ value: 30 }),
  getBasalEnergyBurned: jest.fn().mockResolvedValue({ value: 1200 }),
  Constants: {
    Permissions: {
      Steps: 'Steps',
      Distance: 'Distance',
      Calories: 'Calories',
      HeartRate: 'HeartRate',
      Activity: 'Activity',
      FlightsClimbed: 'FlightsClimbed',
      BasalEnergyBurned: 'BasalEnergyBurned'
    },
    Units: {
      steps: 'count',
      meters: 'meter',
      calories: 'calorie',
      bpm: 'bpm',
      minutes: 'min'
    }
  }
};

export default mockAppleHealthKit;

export const HealthInputOptions = {
  date: 'date',
  anchor: 'anchor',
  period: 'period',
  includeManuallyAdded: 'includeManuallyAdded'
};

export const HealthKitPermissions = {
  read: ['Steps', 'Distance', 'Calories', 'HeartRate', 'Activity', 'FlightsClimbed', 'BasalEnergyBurned'],
  write: []
};

export const HealthObserver = {
  Pedometer: 'Pedometer',
  HeartRate: 'HeartRate'
};

export const HealthUnit = {
  bpm: 'bpm',
  calorie: 'calorie',
  count: 'count',
  meter: 'meter',
  minute: 'minute'
};
