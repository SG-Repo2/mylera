import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { HealthProviderFactory } from '@/src/providers/health/factory/HealthProviderFactory';

export default function HealthSetupScreen() {
    const router = useRouter();
    const [status, setStatus] = useState<string>('Awaiting user action...');

    const handleSetupHealth = async () => {
        try {
            const provider = HealthProviderFactory.getProvider();
            const granted = await provider.requestPermissions();
            const platform = HealthProviderFactory.getPlatform();
            
            setStatus(granted 
                ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} Health Granted` 
                : `${platform.charAt(0).toUpperCase() + platform.slice(1)} Health Denied`
            );

            if (granted) {
                router.replace('/(app)/(home)');
            }
        } catch (error) {
            if (error instanceof Error) {
                setStatus(`Error: ${error.message}`);
            } else {
                setStatus('An unknown error occurred');
            }
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Health Setup</Text>

            <Text style={styles.status}>{status}</Text>

            <Button 
                title="Set up Health Integration" 
                onPress={handleSetupHealth} 
            />

            <Button
                title="Skip for now"
                onPress={() => router.replace('/(app)/(home)')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, 
        alignItems: 'center',
        paddingTop: 40,
    },
    title: {
        fontSize: 22,
        marginBottom: 16,
    },
    status: {
        marginVertical: 12,
        fontSize: 16,
    },
});
