// app/(auth)/register.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signUp } = useAuth(); // You'd need to add signUp method in AuthProvider

  const handleRegister = async () => {
    try {
      // Example signUp usage
      await signUp(email, password);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <View>
      <Text>Register</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Sign Up" onPress={handleRegister} />
    </View>
  );
}