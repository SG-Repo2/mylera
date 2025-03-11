const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Enhanced version with proper Health Connect configuration
const withHealthConnectManifest = (config) => {
  // Step 1: Update the AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Ensure queries section exists
    if (!manifest['queries']) {
      manifest['queries'] = [{}];
    }
    
    // Add Health Connect package query
    const queries = manifest['queries'][0];
    if (!queries['package']) {
      queries['package'] = [];
    }
    
    // Add Health Connect package
    const healthConnectPackage = queries['package'].find(
      pkg => pkg['$'] && pkg['$']['android:name'] === 'com.google.android.apps.healthdata'
    );
    
    if (!healthConnectPackage) {
      queries['package'].push({
        '$': { 'android:name': 'com.google.android.apps.healthdata' }
      });
    }

    // Configure the application and MainActivity
    if (manifest && manifest.application && manifest.application[0]) {
      const app = manifest.application[0];
      
      // Add metadata for health permissions
      if (!app['meta-data']) {
        app['meta-data'] = [];
      }
      
      const healthPermissionsMeta = app['meta-data'].find(
        meta => meta['$'] && meta['$']['android:name'] === 'health_permissions'
      );
      
      if (!healthPermissionsMeta) {
        app['meta-data'].push({
          '$': {
            'android:name': 'health_permissions',
            'android:resource': '@xml/health_permissions'
          }
        });
      }
      
      // Update MainActivity intent filters
      const mainActivity = app.activity.find(
        activity => activity['$'] && activity['$']['android:name'] === '.MainActivity'
      );
      
      if (mainActivity) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }
        
        // Add Health Connect permission rationale intent filter if not exists
        const hasPermissionRationaleFilter = mainActivity['intent-filter'].some(filter => 
          filter.action && filter.action.some(action => 
            action['$'] && action['$']['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
          )
        );
        
        if (!hasPermissionRationaleFilter) {
          mainActivity['intent-filter'].push({
            action: [
              { $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } },
            ],
          });
        }
        
        // Add deep linking intent filter if not exists
        const hasDeepLinkingFilter = mainActivity['intent-filter'].some(filter =>
          filter.data && filter.data.some(data =>
            data['$'] && (data['$']['android:scheme'] === 'mylera' || data['$']['android:scheme'] === 'exp+mylera')
          )
        );
        
        if (!hasDeepLinkingFilter) {
          mainActivity['intent-filter'].push({
            action: [
              { $: { 'android:name': 'android.intent.action.VIEW' } }
            ],
            category: [
              { $: { 'android:name': 'android.intent.category.DEFAULT' } },
              { $: { 'android:name': 'android.intent.category.BROWSABLE' } }
            ],
            data: [
              { $: { 'android:scheme': 'mylera' } },
              { $: { 'android:scheme': 'exp+mylera' } }
            ]
          });
        }
      }
    }
    
    return config;
  });
  
  // Step 2: Create health_permissions.xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      const healthPermissionsPath = path.join(xmlDir, 'health_permissions.xml');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      
      // Only create the file if it doesn't exist
      if (!fs.existsSync(healthPermissionsPath)) {
        const healthPermissionsContent = `<?xml version="1.0" encoding="utf-8"?>
<permissions>
    <permission name="android.permission.health.READ_STEPS"/>
    <permission name="android.permission.health.READ_DISTANCE"/>
    <permission name="android.permission.health.READ_FLOORS_CLIMBED"/>
    <permission name="android.permission.health.READ_ACTIVE_CALORIES_BURNED"/>
    <permission name="android.permission.health.READ_BASAL_METABOLIC_RATE"/>
    <permission name="android.permission.health.READ_EXERCISE"/>
    <permission name="android.permission.health.READ_HEART_RATE"/>
</permissions>`;
        
        fs.writeFileSync(healthPermissionsPath, healthPermissionsContent);
        console.log(`Created health_permissions.xml at ${healthPermissionsPath}`);
      }
      
      return config;
    }
  ]);
  
  return config;
};

module.exports = withHealthConnectManifest;
