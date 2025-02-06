const { withAndroidManifest } = require('@expo/config-plugins');

const withHealthConnectManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    if (manifest && manifest.application && manifest.application[0]) {
      const mainActivity = manifest.application[0].activity.find(
        (activity) =>
          activity['$'] && activity['$']['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }
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

module.exports = withHealthConnectManifest;