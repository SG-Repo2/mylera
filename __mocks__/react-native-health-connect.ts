export const initialize = jest.fn().mockResolvedValue(true);
export const requestPermission = jest.fn().mockResolvedValue(true);
export const readRecords = jest.fn().mockResolvedValue([]);
export const insertRecords = jest.fn().mockResolvedValue(true);
export const deleteRecords = jest.fn().mockResolvedValue(true);

export const TimeRangeFilter = {
  between: jest.fn(),
  after: jest.fn(),
  before: jest.fn()
};

export const RecordType = {
  Steps: 'Steps',
  Distance: 'Distance',
  TotalCaloriesBurned: 'TotalCaloriesBurned',
  HeartRate: 'HeartRate',
  ActiveCaloriesBurned: 'ActiveCaloriesBurned',
  BasalMetabolicRate: 'BasalMetabolicRate',
  FloorsClimbed: 'FloorsClimbed',
  ExerciseSession: 'ExerciseSession'
};

export const Availability = {
  INSTALLED_AND_AVAILABLE: 'INSTALLED_AND_AVAILABLE',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  NOT_INSTALLED: 'NOT_INSTALLED'
};
