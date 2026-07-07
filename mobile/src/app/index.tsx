import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setAccessToken } from '@/api/http-client';
import { loadAuthSession } from '@/auth/auth-storage';

export default function RootRoute() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      const storedSession = await loadAuthSession();
      const hasSession = Boolean(storedSession?.accessToken);

      if (hasSession) {
        setAccessToken(storedSession?.accessToken);
        router.replace('/home');
        return;
      }

      setAccessToken(null);
      router.replace('/login');
    };

    void bootstrap();
  }, [router]);

  return (
    <SafeAreaView style={styles.containerCenter}>
      <ActivityIndicator size="large" color="#0d8a6a" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
