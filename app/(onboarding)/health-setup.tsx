import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';
import { useAuth } from '@/src/providers/AuthProvider';

export default function HealthSetupScreen() {
    const router = useRouter();
    const { requestHealthPermissions, healthPermissionStatus, error } = useAuth();
    const [status, setStatus] = useState<string>('Awaiting user action...');
    const [retryCount, setRetryCount] = useState(0);

    // Effect to handle initial health permission status
    useEffect(() => {
        if (healthPermissionStatus === 'granted') {
            router.replace('/(app)/(home)');
        } else if (healthPermissionStatus === 'denied' && retryCount > 2) {
            setStatus('Health permissions have been denied. Please enable them in your device settings.');
        }
    }, [healthPermissionStatus, retryCount, router]);

    const handleSetupHealth = async () => {
        try {
            setStatus('Requesting health permissions...');
            const platform = HealthProviderFactory.getPlatform();
            const result = await requestHealthPermissions();
            
            if (result === 'granted') {
                setStatus(`${platform} Health access granted`);
                router.replace('/(app)/(home)');
            } else if (result === 'denied') {
                setRetryCount(prev => prev + 1);
                setStatus(`${platform} Health access denied. Please try again or check device settings.`);
            } else {
                setStatus('Permission request failed. Please try again.');
            }
        } catch (err) {
            setRetryCount(prev => prev + 1);
            if (err instanceof Error) {
                if (err.message.includes('42501')) {
                    setStatus('Unable to save health settings. Please try again later.');
                } else {
                    setStatus(`Error: ${err.message}`);
                }
            } else {
                setStatus('An unexpected error occurred');
            }
        }
    };

    const handleSkip = () => {
        // Show warning before skipping
        Alert.alert(
            'Skip Health Integration?',
            'Some features may be limited without health data access. You can enable this later in your profile settings.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Skip',
                    style: 'destructive',
                    onPress: () => router.replace('/(app)/(home)')
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Health Integration Setup</Text>
            
            <View style={styles.infoContainer}>
                <Text style={styles.description}>
                    Connect your health data to track your fitness progress and compete with friends.
                </Text>
                
                <Text style={[
                    styles.status,
                    healthPermissionStatus === 'denied' && styles.errorText
                ]}>
                    {status}
                </Text>
                
                {healthPermissionStatus === 'denied' && retryCount > 2 && (
                    <Text style={styles.errorText}>
                        Please enable health permissions in your device settings to continue.
                    </Text>
                )}
            </View>

            <View style={styles.buttonContainer}>
                <Button
                    title={retryCount > 0 ? "Retry Health Setup" : "Set up Health Integration"}
                    onPress={handleSetupHealth}
                />

                <View style={styles.skipButtonContainer}>
                    <Button
                        title="Skip for now"
                        onPress={handleSkip}
                        color="#666"
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 40,
        backgroundColor: '#F9FAFB',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 24,
        textAlign: 'center',
    },
    infoContainer: {
        marginBottom: 32,
    },
    description: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    status: {
        fontSize: 16,
        color: '#4B5563',
        marginVertical: 12,
        textAlign: 'center',
    },
    errorText: {
        color: '#DC2626',
        textAlign: 'center',
        marginTop: 8,
    },
    buttonContainer: {
        width: '100%',
    },
    skipButtonContainer: {
        marginTop: 12,
    },
});
