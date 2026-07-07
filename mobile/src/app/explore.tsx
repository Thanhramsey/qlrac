import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Phân hệ mobile</Text>
        <Text style={styles.description}>
          Màn hình này đang để sẵn cho các chức năng tiếp theo sau phần đăng nhập.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d5e6e0',
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f2d25',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#35574d',
  },
});
