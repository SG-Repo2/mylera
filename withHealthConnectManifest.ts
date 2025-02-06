import { ConfigPlugin, withAndroidManifest } from '@expo/config-plugins';

const withHealthConnectManifest: ConfigPlugin = (config) => {
  return withAndroidManifest(config, (config) => {
    // Cast modResults to any to bypass type restrictions
    const manifest = config.modResults as any;
    if (manifest && manifest.application && manifest.application[0]) {
      // Locate the MainActivity
      const mainActivity = manifest.application[0].activity.find(
        (activity: any) =>
          activity['$'] && activity['$']['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        // Ensure intent-filters exist
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }
        // Add the Health Connect permission rationale intent filter
        mainActivity['intent-filter'].push({
          action: [
            {
              $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' },
            },
          ],
        });
      }
    }
    return config;
  });
};

export default withHealthConnectManifest;