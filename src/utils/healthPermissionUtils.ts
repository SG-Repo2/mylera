import { HealthProviderPermissionError } from '../providers/health/types/errors';
import { PermissionState, PermissionStatus } from '../providers/health/types/permissions';
import { RawHealthData, RawHealthMetric } from '../providers/health/types/metrics';
import { MetricTypeEnum, MetricUpdateSchema } from '../types/schemas';
import { METRIC_UNITS } from '../providers/health/types/metrics';
import { isValidMetricValue } from './healthMetricUtils';

interface HealthProvider {
  checkPermissionsStatus: () => Promise<PermissionState>;
  getPermissionManager: () => { getPermissionState: () => Promise<PermissionState | null> } | null;
  getMetrics: () => Promise<RawHealthData>;
}

const PERMISSION_CHECK_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  validationTimeout: 5000 // 5 seconds timeout for data validation
};

// Validation constants
const VALIDATION_LIMITS = {
  STEPS: { min: 0, max: 100000 },
  DISTANCE: { min: 0, max: 100000 }, // meters
  CALORIES: { min: 0, max: 10000 },
  HEART_RATE: { min: 30, max: 220 },
  EXERCISE: { min: 0, max: 1440 }, // minutes (24 hours)
  BASAL_CALORIES: { min: 0, max: 5000 },
  FLIGHTS_CLIMBED: { min: 0, max: 500 }
};

export async function verifyHealthPermission(
  provider: HealthProvider,
  permissionType: string
): Promise<boolean> {
  console.log(`[HealthPermissionUtils] Verifying permission for ${permissionType}`, {
    providerType: provider.constructor.name,
    timestamp: new Date().toISOString()
  });
  
  try {
    // First try getting state from permission manager
    const permissionManager = provider.getPermissionManager();
    if (permissionManager) {
      for (let i = 0; i < PERMISSION_CHECK_CONFIG.maxRetries; i++) {
        const managerState = await permissionManager.getPermissionState();
        if (managerState && managerState.status === 'granted') {
          // Validate actual data access when permission is granted
          try {
            const isDataAccessible = await validateDataAccess(provider, permissionType);
            if (isDataAccessible) {
              console.log(`[HealthPermissionUtils] Permission and data access verified for ${permissionType}`);
              return true;
            } else {
              console.warn(`[HealthPermissionUtils] Permission granted but data access failed for ${permissionType}`);
              return false;
            }
          } catch (validationError) {
            console.error(`[HealthPermissionUtils] Data validation error:`, validationError);
            return false;
          }
        }
        
        if (i < PERMISSION_CHECK_CONFIG.maxRetries - 1) {
          console.log(`[HealthPermissionUtils] Retrying permission check ${i + 1}/${PERMISSION_CHECK_CONFIG.maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, PERMISSION_CHECK_CONFIG.retryDelay));
        }
      }
    }

    // Fallback to provider's checkPermissionsStatus
    const permissionState = await provider.checkPermissionsStatus();
    console.log(`[HealthPermissionUtils] Permission state for ${permissionType}:`, permissionState);
    
    if (!isValidPermissionState(permissionState)) {
      console.error(`[HealthPermissionUtils] Invalid permission state for ${permissionType}`);
      return false;
    }
    
    if (permissionState.status !== 'granted') {
      const deniedPermissions = permissionState.deniedPermissions || [];
      const isDenied = deniedPermissions.includes(permissionType);
      
      console.warn(
        `[HealthPermissionUtils] Permission not granted for ${permissionType}`,
        `Status: ${permissionState.status}`,
        isDenied ? `Explicitly denied` : `Not determined`
      );
      
      return false;
    }

    // Validate actual data access when permission is granted
    const isDataAccessible = await validateDataAccess(provider, permissionType);
    if (!isDataAccessible) {
      console.warn(`[HealthPermissionUtils] Permission granted but data access failed for ${permissionType}`);
      return false;
    }
    
    console.log(`[HealthPermissionUtils] Permission and data access verified for ${permissionType}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[HealthPermissionUtils] Error verifying ${permissionType} permission:`,
      errorMessage,
      error
    );
    
    // Enhanced error context
    const errorContext = {
      permissionType,
      providerType: provider.constructor.name,
      timestamp: new Date().toISOString(),
      error: errorMessage
    };
    console.error('[HealthPermissionUtils] Error context:', errorContext);
    
    // Throw a typed error for better error handling
    throw new HealthProviderPermissionError(
      permissionType,
      `Failed to verify permission: ${errorMessage}`
    );
  }
}

/**
 * Validates actual data access by attempting to fetch and validate metric data
 */
async function validateDataAccess(
  provider: HealthProvider,
  permissionType: string
): Promise<boolean> {
  try {
    // Set timeout for data validation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Data validation timed out after ${PERMISSION_CHECK_CONFIG.validationTimeout}ms`));
      }, PERMISSION_CHECK_CONFIG.validationTimeout);
    });

    // Attempt to get metrics with timeout
    const metricsPromise = provider.getMetrics();
    const metrics = await Promise.race([metricsPromise, timeoutPromise]) as RawHealthData;

    // Get the metric type key (e.g., 'steps' from 'steps')
    const metricKey = permissionType.toLowerCase() as keyof RawHealthData;
    const metricData = metrics[metricKey];

    if (!metricData) {
      console.warn(`[HealthPermissionUtils] No data available for ${permissionType}`);
      return false;
    }

    return validateMetricData(permissionType, metricData);
  } catch (error) {
    console.error(`[HealthPermissionUtils] Error validating data access for ${permissionType}:`, error);
    return false;
  }
}

/**
 * Validates metric data structure and values
 */
function validateMetricData(permissionType: string, data: RawHealthMetric[]): boolean {
  try {
    if (!Array.isArray(data)) {
      console.error(`[HealthPermissionUtils] Invalid data structure for ${permissionType}: expected array`);
      return false;
    }

    // Skip validation for empty arrays
    if (data.length === 0) {
      console.log(`[HealthPermissionUtils] No data points to validate for ${permissionType}`);
      return true;
    }

    // Get validation limits for the metric type
    const metricType = permissionType.toUpperCase() as keyof typeof VALIDATION_LIMITS;
    const limits = VALIDATION_LIMITS[metricType];

    if (!limits) {
      console.error(`[HealthPermissionUtils] Unknown metric type: ${permissionType}`);
      return false;
    }

    // Validate each data point
    return data.every((metric, index) => {
      try {
        // Validate basic structure using Zod schema
        const validationResult = MetricUpdateSchema.safeParse({
          value: metric.value,
          timestamp: metric.startDate,
          unit: metric.unit
        });

        if (!validationResult.success) {
          console.error(
            `[HealthPermissionUtils] Invalid metric structure at index ${index}:`,
            validationResult.error
          );
          return false;
        }

        // Validate value range
        if (metric.value < limits.min || metric.value > limits.max) {
          console.error(
            `[HealthPermissionUtils] Value out of range for ${permissionType}:`,
            `${metric.value} (limits: ${limits.min}-${limits.max})`
          );
          return false;
        }

        // Validate using existing utility
        if (!isValidMetricValue(metric.value, permissionType)) {
          console.error(
            `[HealthPermissionUtils] Invalid metric value for ${permissionType}:`,
            metric.value
          );
          return false;
        }

        // Validate dates
        const startDate = new Date(metric.startDate);
        const endDate = new Date(metric.endDate);
        const now = new Date();

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error(`[HealthPermissionUtils] Invalid date format at index ${index}`);
          return false;
        }

        if (startDate > now || endDate > now) {
          console.error(`[HealthPermissionUtils] Future dates detected at index ${index}`);
          return false;
        }

        if (startDate > endDate) {
          console.error(`[HealthPermissionUtils] Start date after end date at index ${index}`);
          return false;
        }

        return true;
      } catch (error) {
        console.error(
          `[HealthPermissionUtils] Validation error for ${permissionType} at index ${index}:`,
          error
        );
        return false;
      }
    });
  } catch (error) {
    console.error(`[HealthPermissionUtils] Error during metric validation:`, error);
    return false;
  }
}

function isValidPermissionState(state: PermissionState): state is PermissionState {
  if (!state || typeof state !== 'object') {
    console.error('[HealthPermissionUtils] Permission state is null or not an object');
    return false;
  }

  if (!state.status || !isValidPermissionStatus(state.status)) {
    console.error('[HealthPermissionUtils] Invalid permission status:', state.status);
    return false;
  }

  if (!state.lastChecked || typeof state.lastChecked !== 'number') {
    console.error('[HealthPermissionUtils] Missing or invalid lastChecked timestamp');
    return false;
  }

  if (state.deniedPermissions && !Array.isArray(state.deniedPermissions)) {
    console.error('[HealthPermissionUtils] deniedPermissions is present but not an array');
    return false;
  }

  return true;
}

function isValidPermissionStatus(status: any): status is PermissionStatus {
  return ['granted', 'denied', 'not_determined'].includes(status);
}
