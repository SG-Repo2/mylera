// File: platforms/fitbit/FitbitHealthProvider.ts
import { BaseHealthProvider } from '../../types/provider';
import type { HealthMetrics, RawHealthData, RawHealthMetric, NormalizedMetric } from '../../types/metrics';
import { METRIC_UNITS } from '../../types/metrics';
import { DateUtils } from '../../../../utils/DateUtils';
import type { PermissionState, PermissionStatus } from '../../types/permissions';
import { HealthProviderPermissionError } from '../../types/errors';

/**
 * FitbitHealthProvider
 *
 * This provider mirrors the structure of AppleHealthProvider and GoogleHealthProvider.
 * It assumes that the Fitbit OAuth 2.0 flow is performed elsewhere and the resulting
 * access token is provided via setAccessToken().
 */
export class FitbitHealthProvider extends BaseHealthProvider {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private codeVerifier: string | null = null;
  private state: string | null = null;

  /**
   * initialize
   *
   * Verifies OAuth credentials and access token
   */
  async initialize(): Promise<void> {
    const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.EXPO_PUBLIC_FITBIT_REDIRECT_URL;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Fitbit OAuth credentials not configured');
    }

    if (this.accessToken && this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('Fitbit access token not set. Please authenticate first.');
    }

    this.initialized = true;
  }

  /**
   * Generate PKCE challenge and verifier
   */
  private async generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const generateRandomString = (length: number) => {
      const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
      let text = '';
      for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return text;
    };

    const codeVerifier = generateRandomString(128);

    // Generate code challenge using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const base64Digest = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return {
      codeVerifier,
      codeChallenge: base64Digest
    };
  }

  /**
   * requestPermissions
   *
   * Implements the Fitbit OAuth 2.0 flow with PKCE
   */
  async requestPermissions(): Promise<PermissionStatus> {
    try {
      const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!;
      const redirectUri = process.env.EXPO_PUBLIC_FITBIT_REDIRECT_URL!;
      const authUrl = process.env.EXPO_PUBLIC_FITBIT_AUTH_URL!;

      // Generate PKCE values
      const { codeVerifier, codeChallenge } = await this.generatePKCE();

      // Generate state for CSRF protection
      const state = Math.random().toString(36).substring(7);
      
      // Store PKCE verifier and state temporarily
      // In a real app, store these securely
      this.codeVerifier = codeVerifier;
      this.state = state;

      // Construct authorization URL
      const scope = 'activity heartrate profile sleep weight';
      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope,
        state
      });

      const authUrlWithParams = `${authUrl}?${authParams.toString()}`;

      // Launch OAuth flow in browser
      const result = await this.handleOAuthFlow(authUrlWithParams);
      
      if (result.success) {
        if (this.permissionManager) {
          await this.permissionManager.updatePermissionState('granted');
        }
        return 'granted';
      }

      throw new Error('OAuth flow failed or was cancelled');
    } catch (error) {
      if (this.permissionManager) {
        await this.permissionManager.handlePermissionError('Fitbit', error);
      }
      return 'denied';
    }
  }

  /**
   * Handle the OAuth flow using browser_action
   */
  private async handleOAuthFlow(authUrl: string): Promise<{ success: boolean }> {
    return new Promise((resolve, reject) => {
      let completed = false;

      const checkResponse = (url: string) => {
        const params = new URL(url).searchParams;
        const code = params.get('code');
        const returnedState = params.get('state');

        if (code && returnedState === this.state) {
          this.exchangeCodeForToken(code).then(() => {
            completed = true;
            resolve({ success: true });
          }).catch(reject);
        }
      };

      // Launch browser for OAuth
      (window as any).browser_action({
        action: 'launch',
        url: authUrl
      }).then(() => {
        // Monitor for redirect
        const checkInterval = setInterval(() => {
          if (completed) {
            clearInterval(checkInterval);
          } else {
            const currentUrl = window.location.href;
            if (currentUrl.includes('code=')) {
              checkResponse(currentUrl);
            }
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!completed) {
            clearInterval(checkInterval);
            reject(new Error('OAuth flow timed out'));
          }
        }, 300000);
      }).catch(reject);
    });
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<void> {
    const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!;
    const clientSecret = process.env.EXPO_PUBLIC_FITBIT_CLIENT_SECRET!;
    const redirectUri = process.env.EXPO_PUBLIC_FITBIT_REDIRECT_URL!;
    const tokenUrl = process.env.EXPO_PUBLIC_FITBIT_TOKEN_URL!;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: this.codeVerifier!
      }).toString()
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  }

  /**
   * Refresh the access token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const clientId = process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID!;
    const clientSecret = process.env.EXPO_PUBLIC_FITBIT_CLIENT_SECRET!;
    const tokenUrl = process.env.EXPO_PUBLIC_FITBIT_TOKEN_URL!;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      }).toString()
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
  }

  /**
   * checkPermissionsStatus
   *
   * Returns a cached permission state if available, or checks if the access token exists.
   */
  async checkPermissionsStatus(): Promise<PermissionState> {
    if (this.permissionManager) {
      const cached = await this.permissionManager.getPermissionState();
      if (cached) {
        return cached;
      }
    }
    const status: PermissionStatus = this.accessToken ? 'granted' : 'not_determined';
    const state: PermissionState = { status, lastChecked: Date.now() };
    if (this.permissionManager) {
      await this.permissionManager.updatePermissionState(status);
    }
    return state;
  }

  /**
   * Helper: fetchFromFitbit
   *
   * Makes a GET request to the specified Fitbit URL with the Bearer token.
   */
  private async fetchFromFitbit(url: string): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No Fitbit access token available');
    }
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Fitbit API error: ${response.status}`);
    }
    return response.json();
  }

  /**
   * fetchRawMetrics
   *
   * For simplicity, this implementation assumes that the startDate and endDate
   * fall on the same day. Fitbit’s daily endpoints are used to fetch raw metrics.
   */
  async fetchRawMetrics(
    startDate: Date,
    endDate: Date,
    types: string[]
  ): Promise<RawHealthData> {
    const permissionState = await this.checkPermissionsStatus();
    if (permissionState.status !== 'granted') {
      throw new HealthProviderPermissionError('Fitbit', 'Permission not granted for Fitbit data access');
    }
    await this.ensureInitialized();

    // Fitbit endpoints are typically date-based; we assume both dates are the same.
    const dateStr = startDate.toISOString().split('T')[0];
    const rawData: RawHealthData = {};

    await Promise.all(
      types.map(async (type) => {
        switch (type) {
          case 'steps':
            rawData.steps = await this.fetchStepsRaw(dateStr);
            break;
          case 'distance':
            rawData.distance = await this.fetchDistanceRaw(dateStr);
            break;
          case 'calories':
            rawData.calories = await this.fetchCaloriesRaw(dateStr);
            break;
          case 'heart_rate':
            rawData.heart_rate = await this.fetchHeartRateRaw(dateStr);
            break;
          case 'basal_calories':
            rawData.basal_calories = await this.fetchBasalCaloriesRaw(dateStr);
            break;
          case 'flights_climbed':
            rawData.flights_climbed = await this.fetchFlightsClimbedRaw(dateStr);
            break;
          case 'exercise':
            rawData.exercise = await this.fetchExerciseRaw(dateStr);
            break;
        }
      })
    );

    return rawData;
  }

  // ----- Below are helper methods to fetch each metric type via Fitbit API -----

  private async fetchStepsRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/steps/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-steps'] && data['activities-steps'].length > 0) {
      return data['activities-steps'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: Number(item.value),
        unit: 'count',
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchDistanceRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/distance/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/distance/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-distance'] && data['activities-distance'].length > 0) {
      return data['activities-distance'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: Number(item.value),
        unit: METRIC_UNITS.DISTANCE,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchCaloriesRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/calories/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/calories/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-calories'] && data['activities-calories'].length > 0) {
      return data['activities-calories'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        value: Number(item.value),
        unit: METRIC_UNITS.CALORIES,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchHeartRateRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Endpoint: /activities/heart/date/{date}/1d.json
    const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${dateStr}/1d.json`;
    const data = await this.fetchFromFitbit(url);
    if (data && data['activities-heart'] && data['activities-heart'].length > 0) {
      return data['activities-heart'].map((item: any) => ({
        startDate: `${item.dateTime}T00:00:00.000Z`,
        endDate: `${item.dateTime}T23:59:59.999Z`,
        // Here we use restingHeartRate if available; otherwise default to 0.
        value: item.value.restingHeartRate ? Number(item.value.restingHeartRate) : 0,
        unit: METRIC_UNITS.HEART_RATE,
        sourceBundle: 'com.fitbit.api'
      }));
    }
    return [];
  }

  private async fetchBasalCaloriesRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // Fitbit does not provide a direct endpoint for basal calories.
    // Return a placeholder (zero value) for now.
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.CALORIES,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  private async fetchFlightsClimbedRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // There is no direct Fitbit endpoint for flights climbed.
    // Return a placeholder (zero value) for now.
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.COUNT,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  private async fetchExerciseRaw(dateStr: string): Promise<RawHealthMetric[]> {
    // For this example, we assume no dedicated exercise endpoint.
    // You might consider using "active minutes" or another metric.
    return [{
      startDate: `${dateStr}T00:00:00.000Z`,
      endDate: `${dateStr}T23:59:59.999Z`,
      value: 0,
      unit: METRIC_UNITS.EXERCISE,
      sourceBundle: 'com.fitbit.api'
    }];
  }

  /**
   * normalizeMetrics
   *
   * Converts raw Fitbit data into the standard NormalizedMetric format.
   */
  normalizeMetrics(rawData: RawHealthData, type: string): NormalizedMetric[] {
    const metrics: NormalizedMetric[] = [];
    switch (type) {
      case 'steps':
        if (rawData.steps) {
          metrics.push(...rawData.steps.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.STEPS,
            type: 'steps'
          } as NormalizedMetric)));
        }
        break;
      case 'distance':
        if (rawData.distance) {
          metrics.push(...rawData.distance.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.DISTANCE,
            type: 'distance'
          } as NormalizedMetric)));
        }
        break;
      case 'calories':
        if (rawData.calories) {
          metrics.push(...rawData.calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type: 'calories'
          } as NormalizedMetric)));
        }
        break;
      case 'heart_rate':
        if (rawData.heart_rate) {
          metrics.push(...rawData.heart_rate.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.HEART_RATE,
            type: 'heart_rate'
          } as NormalizedMetric)));
        }
        break;
      case 'basal_calories':
        if (rawData.basal_calories) {
          metrics.push(...rawData.basal_calories.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.CALORIES,
            type: 'basal_calories'
          } as NormalizedMetric)));
        }
        break;
      case 'flights_climbed':
        if (rawData.flights_climbed) {
          metrics.push(...rawData.flights_climbed.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.COUNT,
            type: 'flights_climbed'
          } as NormalizedMetric)));
        }
        break;
      case 'exercise':
        if (rawData.exercise) {
          metrics.push(...rawData.exercise.map(raw => ({
            timestamp: raw.endDate,
            value: raw.value,
            unit: METRIC_UNITS.EXERCISE,
            type: 'exercise'
          } as NormalizedMetric)));
        }
        break;
    }
    return metrics;
  }

  /**
   * getMetrics
   *
   * Aggregates the normalized metrics into a HealthMetrics object.
   */
  async getMetrics(): Promise<HealthMetrics> {
    const now = new Date();
    const startOfDay = DateUtils.getStartOfDay(now);
    const rawData = await this.fetchRawMetrics(
      startOfDay,
      now,
      ['steps', 'distance', 'calories', 'heart_rate', 'basal_calories', 'flights_climbed', 'exercise']
    );

    const steps = this.aggregateMetric(this.normalizeMetrics(rawData, 'steps'));
    const distance = this.aggregateMetric(this.normalizeMetrics(rawData, 'distance'));
    const calories = this.aggregateMetric(this.normalizeMetrics(rawData, 'calories'));
    const heart_rate = this.aggregateMetric(this.normalizeMetrics(rawData, 'heart_rate'));
    const basal_calories = this.aggregateMetric(this.normalizeMetrics(rawData, 'basal_calories'));
    const flights_climbed = this.aggregateMetric(this.normalizeMetrics(rawData, 'flights_climbed'));
    const exercise = this.aggregateMetric(this.normalizeMetrics(rawData, 'exercise'));

    return {
      id: '',
      user_id: '',
      date: now.toISOString().split('T')[0],
      steps,
      distance,
      calories,
      heart_rate,
      basal_calories,
      flights_climbed,
      exercise,
      daily_score: 0,
      weekly_score: null,
      streak_days: null,
      last_updated: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  /**
   * aggregateMetric
   *
   * A simple aggregation (summing) of normalized metric values.
   */
  private aggregateMetric(metrics: NormalizedMetric[]): number {
    return metrics.reduce((sum, metric) => sum + metric.value, 0);
  }

  /**
   * setAccessToken
   *
   * Sets the Fitbit access token; this method should be called after a successful OAuth flow.
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}
