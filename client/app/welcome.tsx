import { Image } from "expo-image";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from 'react-i18next';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1, paddingHorizontal: 32, paddingBottom: 40 }}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <Image
            source={require("@/assets/logo/SakayNE.png")}
            style={{ width: 140, height: 140, marginBottom: 24 }}
            contentFit="contain"
          />
          <Text
            style={{
              fontSize: 15,
              color: "#8FA092",
              marginTop: 8,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            Your trusted ride-hailing app.{"\n"}Safe, easy, and reliable.
          </Text>
        </View>

        <View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('auth.passengerSignup')}
            onPress={() => router.push("/(auth)/signup")}
            activeOpacity={0.85}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#3F8451",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
              {t('auth.passengerSignup')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Register as driver"
            onPress={() => router.push('/driver-register')}
            activeOpacity={0.85}
            style={{ width: '100%', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3F8451', marginTop: 12 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#3F8451' }}>Register as driver</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.7}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 16,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#F5F7F5",
              marginTop: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#3F8451" }}>
              I already have an account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
