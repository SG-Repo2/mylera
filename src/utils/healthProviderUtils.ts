/**
 * @deprecated This file has been split into separate utility files:
 * - errorUtils.ts: Error mapping functions
 * - healthMetricUtils.ts: Metric normalization and aggregation
 * - healthInitUtils.ts: Health provider initialization
 * 
 * Please import from the appropriate utility file instead.
 */

export { mapAuthError, mapHealthProviderError } from './errorUtils';
export { normalizeMetric, aggregateMetrics } from './healthMetricUtils';
export { initializeHealthProviderForUser } from './healthInitUtils';
