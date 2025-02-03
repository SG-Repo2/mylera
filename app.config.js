export default {
  expo: {
    name: "mylera",
    slug: "mylera",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mylera",
    userInterfaceStyle: "automatic",
    "assets": ["./src/assets/animations"],

    plugins: [
      "expo-router",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 26,
          },
          ios: {
            deploymentTarget: "16.1",
            useFrameworks: "static",
            newArchEnabled: false,
          },
        },
      ],
    ],
    
    ios: {
      bundleIdentifier: "com.groebe1kenobi.mylera",
      infoPlist: {
        NSHealthShareUsageDescription: "This app requires access to health data to track your fitness metrics.",
        NSHealthUpdateUsageDescription: "This app requires access to health data to track your fitness metrics.",
        UIBackgroundModes: ["fetch", "remote-notification"],
      },
      config: {
        usesNonExemptEncryption: false
      },
      entitlements: {
        "com.apple.developer.healthkit": true,
        "com.apple.developer.healthkit.background-delivery": true,
        "com.apple.developer.healthkit.read": [
          "HKQuantityTypeIdentifierStepCount",
          "HKQuantityTypeIdentifierDistanceWalkingRunning",
          "HKQuantityTypeIdentifierHeartRate",
          "HKQuantityTypeIdentifierActiveEnergyBurned",
          "HKQuantityTypeIdentifierFlightsClimbed",
          "HKQuantityTypeIdentifierBasalEnergyBurned",
          "HKQuantityTypeIdentifierAppleExerciseTime"
        ]
      }
    },
    android: {
      package: "com.groebe1kenobi.mylera",
      permissions: [
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_DISTANCE",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_FLIGHTS_CLIMBED",
        "android.permission.health.READ_BASAL_METABOLIC_RATE",
        "android.permission.health.READ_EXERCISE"
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