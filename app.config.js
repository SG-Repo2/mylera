const path = require('path');
const dotenv = require('dotenv');

// Determine which .env file to load. 
// By default, we'll use .env.test, unless you set ENVFILE in your environment.
const envFile = process.env.ENVFILE || '.env.test';
dotenv.config({ path: path.resolve(__dirname, envFile) });

module.exports = {
  expo: {
    name: "mylera",
    slug: "mylera",
    version: "1.0.2",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mylera",
    newArchEnabled: false,
    userInterfaceStyle: "automatic",
    assets: ["./src/assets/animations"],
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    plugins: [
      "expo-router",
      "./withHealthConnectManifest",
      "expo-health-connect",
      "expo-image-picker",
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 26,
            usesCleartextTraffic: true
          },
          ios: {
            deploymentTarget: "16.1",
            useFrameworks: "static"
          }
        }
      ]
    ],
    
    ios: {
      bundleIdentifier: "com.groebe1kenobi.mylera",
      infoPlist: {
        NSHealthKitUsageDescription: "Mylera needs access to your health data to track fitness metrics and provide personalized insights.",
        NSHealthShareUsageDescription: "This app requires access to health data to track your fitness metrics.",
        NSHealthUpdateUsageDescription: "This app requires access to health data to track your fitness metrics.",
        NSPhotoLibraryUsageDescription: "Allow MyLera to access your photos to set a profile picture",
        NSCameraUsageDescription: "Allow MyLera to access your camera to take a profile picture"
      },
      config: {
        usesNonExemptEncryption: false
      },
      entitlements: {
        "com.apple.developer.healthkit": true
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.groebe1kenobi.mylera",
      permissions: [
        "android.permission.health.READ_STEPS",
        "android.permission.health.READ_DISTANCE",
        "android.permission.health.READ_HEART_RATE",
        "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
        "android.permission.health.READ_FLIGHTS_CLIMBED",
        "android.permission.health.READ_BASAL_METABOLIC_RATE",
        "android.permission.health.READ_EXERCISE",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE"
      ]
    },
    extra: {
      eas: {
        projectId: "094cff24-896c-4aa7-bc5c-f6ad805c83e6"
      },
      scheme: "mylera",
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
};
