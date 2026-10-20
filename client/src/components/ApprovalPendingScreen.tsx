import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '@/src/auth/auth.service';
import { router } from 'expo-router';

const B = '#3F8451';
const C = '#0D1F16';
const G = '#8FA092';
const bg = '#F5F7F5';

export default function ApprovalPendingScreen({ status = 'pending', fullName }: { status?: 'pending' | 'rejected'; fullName?: string }) {
  const isRejected = status === 'rejected';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 32 }}>
          <View style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: isRejected ? '#FEF2F2' : '#FEF3C7',
            justifyContent: 'center', alignItems: 'center', marginBottom: 24,
          }}>
            <Ionicons
              name={isRejected ? 'close-circle' : 'hourglass'}
              size={64}
              color={isRejected ? '#EF4444' : '#D97706'}
            />
          </View>

          <Text style={{ fontSize: 24, fontWeight: '800', color: C, textAlign: 'center', marginBottom: 8 }}>
            {isRejected ? 'Application Rejected' : 'Account Under Review'}
          </Text>

          <Text style={{ fontSize: 14, color: G, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 }}>
            {isRejected
              ? 'Unfortunately, your driver application was not approved. Please contact support for more information.'
              : 'Admin needs to approve your account before you can use this app.'}
          </Text>
        </View>

        {!isRejected && (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
              <Ionicons name="information-circle" size={20} color="#D97706" style={{ marginRight: 10, marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19, fontWeight: '600' }}>
                Why am I seeing this?
              </Text>
            </View>

            <View style={{ paddingLeft: 30 }}>
              {[
                'Your documents and information are being reviewed by our team.',
                'This process usually takes 24-48 hours.',
                'You will be notified once your account is approved.',
                'For your safety, all driver applications must be verified.',
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706', marginTop: 8, marginRight: 10 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: '#78350F', lineHeight: 19 }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ backgroundColor: bg, borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: '#F0F7F1', justifyContent: 'center', alignItems: 'center', marginRight: 12,
            }}>
              <Ionicons name="shield-checkmark" size={18} color={B} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C }}>Account Status</Text>
          </View>
          <View style={{ paddingLeft: 48 }}>
            <Text style={{ fontSize: 13, color: G, marginBottom: 4 }}>Driver</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C, marginBottom: 12 }}>{fullName || 'You'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                backgroundColor: isRejected ? '#FEF2F2' : '#FEF3C7',
              }}>
                <Text style={{
                  fontSize: 11, fontWeight: '800',
                  color: isRejected ? '#991B1B' : '#92400E',
                  textTransform: 'uppercase', letterSpacing: 1,
                }}>
                  {status}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <Text style={{ fontSize: 12, color: G, textAlign: 'center', marginBottom: 16, lineHeight: 17 }}>
          Need help? Contact us at support@sakayne.com
        </Text>

        <View
          onTouchEnd={() => { void logout().catch(() => {}).finally(() => router.replace('/(auth)/login')); }}
          style={{
            width: '100%', height: 52, borderRadius: 16,
            justifyContent: 'center', alignItems: 'center',
            backgroundColor: bg, borderWidth: 1, borderColor: '#E5E7EB',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: C }}>Sign Out</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
