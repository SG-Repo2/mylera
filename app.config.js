export default {
  expo: {
    name: "mylera",
    slug: "mylera",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mylera",
    userInterfaceStyle: "automatic",
    plugins: [
      "expo-router",
      [
        "expo-health-connect",
        {
          package: "com.groebe1kenobi.mylera", 
          modes: ["read"]
        }
      ],
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 26
          },
          ios: {
            deploymentTarget: "16.1"
          }
        }
      ]
    ],
    ios: {
      bundleIdentifier: "com.groebe1kenobi.mylera",
      infoPlist: {
        NSHealthShareUsageDescription: "Allow Mylera to read your health data for activity tracking",
        NSHealthKitUsageDescription: "Mylera securely accesses HealthKit to track your fitness metrics"
      },
      entitlements: {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.read": [
          "HKQuantityTypeIdentifierStepCount",
          "HKQuantityTypeIdentifierDistanceWalkingRunning",
          "HKQuantityTypeIdentifierHeartRate",
          "HKQuantityTypeIdentifierActiveEnergyBurned"
        ]
      }
    },
    android: {
      package: "com.groebe1kenobi.mylera",
      permissions: [
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_DISTANCE",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED"
      ]
    },
    extra: {
      eas: {
        projectId: "094cff24-896c-4aa7-bc5c-f6ad805c83e6"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
};