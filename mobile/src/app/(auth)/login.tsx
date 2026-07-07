import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { httpClient, setAccessToken } from '@/api/http-client';
import { loadAuthSession, saveAuthSession } from '@/auth/auth-storage';
import { API_BASE_URL } from '@/constants/api-base-url';
import type { LoginResponse } from '@/types/auth';

export default function LoginRoute() {
  const router = useRouter();
  const [taiKhoanOrSoGiayTo, setTaiKhoanOrSoGiayTo] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const storedSession = await loadAuthSession();
      if (storedSession?.accessToken) {
        setAccessToken(storedSession.accessToken);
        router.replace('/home');
        return;
      }

      setAccessToken(null);
      setBooting(false);
    };

    void checkSession();
  }, [router]);

  const canSubmit = useMemo(
    () => Boolean(taiKhoanOrSoGiayTo.trim()) && Boolean(matKhau.trim()) && !loading,
    [taiKhoanOrSoGiayTo, matKhau, loading],
  );

  const handleLogin = async () => {
    if (!canSubmit) {
      return;
    }

    setLoading(true);
    try {
      const response = await httpClient.post<LoginResponse>('/auth/login', {
        taiKhoanOrSoGiayTo: taiKhoanOrSoGiayTo.trim(),
        matKhau,
      });

      setAccessToken(response.data.accessToken);
      await saveAuthSession(response.data);
      setMatKhau('');
      router.replace('/home');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Không đăng nhập được, vui lòng thử lại';
      Alert.alert('Đăng nhập thất bại', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <ActivityIndicator size="large" color="#0d8a6a" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>App Thu Rác Mobile</Text>
        <Text style={styles.title}>Đăng nhập hệ thống</Text>
        <Text style={styles.baseUrl}>API: {API_BASE_URL}</Text>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Tài khoản hoặc CCCD/CMND</Text>
          <TextInput
            value={taiKhoanOrSoGiayTo}
            onChangeText={setTaiKhoanOrSoGiayTo}
            placeholder="admin01 hoặc 0792xxxxxx"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            value={matKhau}
            onChangeText={setMatKhau}
            placeholder="Nhập mật khẩu"
            secureTextEntry
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={handleLogin}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            (!canSubmit || pressed) && styles.buttonPressed,
          ]}>
          <Text style={styles.primaryButtonText}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  containerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    gap: 12,
  },
  kicker: { color: '#0d8a6a', fontWeight: '700' },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f2d25',
  },
  baseUrl: {
    color: '#4c776b',
    fontSize: 12,
  },
  fieldWrap: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1b3d34',
  },
  input: {
    borderWidth: 1,
    borderColor: '#b7d3c9',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 12,
    color: '#11342b',
    backgroundColor: '#f8fcfa',
  },
  primaryButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#0d8a6a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
