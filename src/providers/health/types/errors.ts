export class HealthProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HealthProviderError';
  }
}

export class HealthProviderInitializationError extends HealthProviderError {
  constructor(platform: string, details?: string) {
    super(`Failed to initialize health provider for ${platform}${details ? `: ${details}` : ''}`);
    this.name = 'HealthProviderInitializationError';
  }
}

export class HealthProviderPermissionError extends HealthProviderError {
  constructor(permission: string, details?: string) {
    super(`Health permission denied for ${permission}${details ? `: ${details}` : ''}`);
    this.name = 'HealthProviderPermissionError';
  }
}

export class HealthProviderUnavailableError extends HealthProviderError {
  constructor(platform: string) {
    super(`Health services are not available on this ${platform} device`);
    this.name = 'HealthProviderUnavailableError';
  }
}

export class HealthMetricError extends HealthProviderError {
  constructor(metricType: string, details: string) {
    super(`Error fetching health metric ${metricType}: ${details}`);
    this.name = 'HealthMetricError';
  }
}

export class HealthDataNormalizationError extends HealthProviderError {
  constructor(metricType: string, details: string) {
    super(`Error normalizing health data for ${metricType}: ${details}`);
    this.name = 'HealthDataNormalizationError';
  }
}

export class HealthDataError extends HealthProviderError {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HealthDataError';
    this.code = code;
  }
}
