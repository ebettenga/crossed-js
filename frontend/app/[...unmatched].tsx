import { View, StyleSheet } from 'react-native';
import { Text } from '~/components/ui/text';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Oops!</Text>
        <Text style={styles.subtitle}>This page doesn't exist.</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.buttonText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2B2B2B',
    marginBottom: 8,
    fontFamily: 'Times New Roman',
  },
  subtitle: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 32,
    fontFamily: 'Times New Roman',
  },
  button: {
    backgroundColor: '#8B0000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 