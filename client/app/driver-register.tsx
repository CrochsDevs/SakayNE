import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '@/src/components/ui/Input';
import DotLoader from '@/src/components/ui/DotLoader';
import { signup } from '@/src/auth/auth.service';
import { showError, showSuccess } from '@/src/utils/toast';

const STEPS = ['Personal', 'Sasakyan', 'Verification'];
const VEHICLE_TYPES = ['jeepney', 'bus'];



export default function DriverRegisterScreen() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});



  const [form, setForm] = useState({
    // Personal
    fullName: '', phone: '', email: '', password: '', confirmPassword: '', address: '',
    // Driver
    licenseNo: '', licenseExpiry: '',
    // Vehicle
    vehicleType: 'jeepney', plateNo: '', color: '', seatingCapacity: '',
    // Franchise
    franchiseNo: '', cpc: '', operatorName: '',
    // Company (optional)
    companyName: '', contactPerson: '', contactNumber: '',
  });

  const [docs, setDocs] = useState<Record<string, { uri: string; name: string; base64: string; mimeType: string } | null>>({
    licenseFront: null, licenseBack: null, vehicleReg: null, selfie: null,
  });

  const pickDocument = async (key: string) => {
    try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      if (result.assets[0].base64.length > 2500000) { showError('Document too large. Choose a smaller image.'); return; }
      const asset = result.assets[0];
      setDocs((p) => ({ ...p, [key]: { uri: asset.uri, name: asset.fileName || key, base64: asset.base64!, mimeType: asset.mimeType || 'image/jpeg' } }));
    }
    } catch(e) { showError(e instanceof Error ? e.message : 'Unable to open image library'); }
  };

  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const [dob, setDob] = useState({ day: '', month: '', year: '' });
  const handleDOB = (value: string, part: 'day' | 'month' | 'year') => {
    const nums = value.replace(/\D/g, '');
    if (part === 'day' && nums.length <= 2) { setDob((p) => ({ ...p, day: nums })); if (nums.length === 2) monthRef.current?.focus(); }
    if (part === 'month' && nums.length <= 2) { setDob((p) => ({ ...p, month: nums })); if (nums.length === 2) yearRef.current?.focus(); }
    if (part === 'year' && nums.length <= 4) setDob((p) => ({ ...p, year: nums }));
  };
  const getDobStr = () => {
    const y = dob.year.padStart(4, '0');
    const m = dob.month.padStart(2, '0');
    const d = dob.day.padStart(2, '0');
    return dob.year && dob.month && dob.day ? `${y}-${m}-${d}` : '';
  };

  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [showTownPicker, setShowTownPicker] = useState<'from' | 'to' | null>(null);

  const TOWNS = ['Aliaga','Bongabon','Cabanatuan City','Cabiao','Carranglan','Cuyapo','Gabaldon','Gapan City','Gen. M. Natividad','Gen. Tinio','Guimba','Jaen','Laur','Licab','Llanera','Lupao','Nampicuan','Palayan City','Pantabangan','Penaranda','Quezon','Rizal','San Antonio','San Isidro','San Jose City','San Leonardo','Santa Rosa','Sci. City of Munoz','Santo Domingo','Talugtug','Talavera','Zaragoza'];

  const u = (key: string, value: string) => { setForm((f) => ({ ...f, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); };
  const B = '#087F8C'; const C = '#153B43'; const G = '#728A8E'; const bg = '#F7F5EF';

  const validateStep = (s: number) => {
    const e: Record<string, string | undefined> = {};
    if (s === 0) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Valid email required';
    if (!form.fullName.trim()) e.fullName = 'Kailangan';
    if (!form.phone.trim()) e.phone = 'Kailangan';
    if (!form.address.trim()) e.address = 'Kailangan';
    if (!dob.day || !dob.month || !dob.year) e.dob = 'Kailangan';
    if (!form.password || form.password.length < 8) e.password = '8+ characters';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Hindi tugma';
    }
    if (s === 1) {
      if (!form.licenseNo.trim()) e.licenseNo = 'Kailangan';
      if (!form.plateNo.trim()) e.plateNo = 'Kailangan';
      if (!routeFrom || !routeTo) e.route = 'Kailangan';
      else if (routeFrom === routeTo) e.route = 'Parehas ang From at To';
    }
    if (s === 2) { for (const key of ['licenseFront','licenseBack','vehicleReg','selfie']) if (!docs[key]) e[key] = 'Upload required'; }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => { if (validateStep(step)) setStep(Math.min(2, step + 1)); };
  const prevStep = () => setStep(Math.max(0, step - 1));

  const handleSubmit = async () => {
    if (![0,1,2].every(validateStep)) return;
    setLoading(true);
    try {
      await signup(form.fullName, form.email, form.phone, form.password, 'driver', {
        licenseNo: form.licenseNo, licenseExpiry: form.licenseExpiry, plateNo: form.plateNo, vehicleType: form.vehicleType,
        color: form.color, seatingCapacity: form.seatingCapacity,
        franchiseNo: form.franchiseNo, cpc: form.cpc, operatorName: form.operatorName,
        route: `${routeFrom} - ${routeTo}`, companyName: form.companyName, contactPerson: form.contactPerson, contactNumber: form.contactNumber,
        dob: getDobStr(), documents: docs, address: form.address,
      });
      showSuccess('Naipadala na!', 'Tingnan ang email');
      setTransitioning(true);
      setTimeout(() => router.push({ pathname: '/(auth)/verify-otp', params: { email: form.email } }), 800);
    } catch (err: any) { showError('Error', err.message); } finally { setLoading(false); }
  };

  const btn = (label: string, onPress: () => void, color?: string, outline?: boolean) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{
      flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
      backgroundColor: outline ? bg : (color || B),
      boxShadow: outline ? 'none' : '0 4px 8px rgba(8,127,140,0.2)',
      elevation: 4,
    }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: outline ? G : '#fff' }}>{label}</Text>
    </TouchableOpacity>
  );

  const sectionTitle = (title: string) => <Text style={{ fontSize: 14, fontWeight: '700', color: B, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{title}</Text>;

  const selectGroup = (label: string, options: string[], selected: string, key: string) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: C, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <TouchableOpacity key={opt} onPress={() => u(key, opt)}
            style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: selected === opt ? B : bg }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: selected === opt ? '#fff' : G }}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const docUpload = (key: string, label: string) => {
    const file = docs[key];
    return (
      <TouchableOpacity onPress={() => pickDocument(key)} activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: file ? B : '#E5E7EB', borderStyle: file ? 'solid' : 'dashed' }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: file ? '#E5F5F1' : '#E5E7EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
          <Ionicons name={file ? 'checkmark-circle' : 'camera-outline'} size={20} color={file ? B : G} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C }}>{label}</Text>
          <Text style={{ fontSize: 12, color: file ? B : G, marginTop: 2 }}>{file ? 'Selected for upload' : errors[key] || 'Mag-upload'}</Text>
        </View>
        {file ? <Ionicons name="checkmark-circle" size={22} color={B} /> : <Ionicons name="cloud-upload-outline" size={20} color={G} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <TouchableOpacity onPress={() => step === 0 ? router.back() : prevStep()} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
            <Ionicons name="arrow-back" size={24} color={C} />
          </TouchableOpacity>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C, marginTop: 16, marginBottom: 4 }}>Driver Register</Text>
          <Text style={{ fontSize: 15, color: G, marginBottom: 24 }}>Step {step + 1} of 3: {STEPS[step]}</Text>

          {/* Step Progress */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: B, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>1</Text>
            </View>
            <View style={{ flex: 1, height: 3, backgroundColor: step >= 1 ? B : '#E5E7EB', marginHorizontal: 6 }} />
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step >= 1 ? B : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: step >= 1 ? '#fff' : G }}>2</Text>
            </View>
            <View style={{ flex: 1, height: 3, backgroundColor: step >= 2 ? B : '#E5E7EB', marginHorizontal: 6 }} />
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step >= 2 ? B : '#E5E7EB', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: step >= 2 ? '#fff' : G }}>3</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -14, marginBottom: 20, paddingHorizontal: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: B }}>Personal</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: step >= 1 ? B : G }}>Sasakyan</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: step >= 2 ? B : G }}>Verification</Text>
          </View>

          {/* STEP 1: Personal + Driver Info */}
          {step === 0 && <>
            {sectionTitle('Personal')}
            <Input label="Buong Pangalan (Kailangan)" placeholder="Juan Dela Cruz" value={form.fullName} onChangeText={(v) => u('fullName', v)} icon="person-outline" error={errors.fullName} autoCapitalize="words" />
            <Input label="Phone Number (Kailangan)" placeholder="0912 345 6789" value={form.phone} onChangeText={(v) => u('phone', v)} keyboardType="phone-pad" icon="phone-portrait-outline" error={errors.phone} />
            <Input label="Email" placeholder="juan@email.com" value={form.email} onChangeText={(v) => u('email', v)} keyboardType="email-address" icon="mail-outline" error={errors.email} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: C, marginBottom: 6 }}>Kaarawan (Kailangan)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1.2 }}>
                <TextInput ref={dayRef} value={dob.day} onChangeText={(v) => handleDOB(v, 'day')} placeholder="DD" placeholderTextColor={G} maxLength={2}
                  keyboardType="number-pad" style={{ height: 52, borderRadius: 12, backgroundColor: bg, textAlign: 'center', fontSize: 18, fontWeight: '600', color: C }} />
              </View>
              <Text style={{ fontSize: 24, color: G, alignSelf: 'center' }}>/</Text>
              <View style={{ flex: 1.2 }}>
                <TextInput ref={monthRef} value={dob.month} onChangeText={(v) => { const n = v.replace(/\D/g, '').slice(0, 2); let val = n; if (n.length === 2) val = Math.min(12, Math.max(1, parseInt(n) || 1)).toString().padStart(2, '0'); handleDOB(val, 'month'); }} placeholder="MM" placeholderTextColor={G} maxLength={2}
                  keyboardType="number-pad" style={{ height: 52, borderRadius: 12, backgroundColor: bg, textAlign: 'center', fontSize: 18, fontWeight: '600', color: C }} />
              </View>
              <Text style={{ fontSize: 24, color: G, alignSelf: 'center' }}>/</Text>
              <View style={{ flex: 2 }}>
                <TextInput ref={yearRef} value={dob.year} onChangeText={(v) => handleDOB(v, 'year')} placeholder="YYYY" placeholderTextColor={G} maxLength={4}
                  keyboardType="number-pad" style={{ height: 52, borderRadius: 12, backgroundColor: bg, textAlign: 'center', fontSize: 18, fontWeight: '600', color: C }} />
              </View>
            </View>
            <Input label="Address (Kailangan)" placeholder="Tirahan" value={form.address} onChangeText={(v) => u('address', v)} icon="home-outline" />

            <View style={{ height: 12 }} />
            {sectionTitle('Account')}
            <Input label="Gumawa ng Password *" placeholder="6+ characters" value={form.password} onChangeText={(v) => u('password', v)} secureTextEntry icon="lock-closed-outline" error={errors.password} />
            <Input label="Ulitin ang Password *" placeholder="I-ulit" value={form.confirmPassword} onChangeText={(v) => u('confirmPassword', v)} secureTextEntry icon="lock-closed-outline" error={errors.confirmPassword} />

            <View style={{ height: 20 }} />
            <TouchableOpacity onPress={nextStep} activeOpacity={0.85} style={{ width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: B, boxShadow: '0 4px 8px rgba(8,127,140,0.2)', elevation: 4 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Susunod</Text>
            </TouchableOpacity>
          </>}

          {/* STEP 2: Vehicle + Franchise */}
          {step === 1 && <>
            {sectionTitle('Lisensya')}
            <Input label="License Number (Kailangan)" placeholder="N01-23-456789" value={form.licenseNo} onChangeText={(v) => u('licenseNo', v)} icon="card-outline" error={errors.licenseNo} />
            <Input label="License Expiry (Optional)" placeholder="YYYY-MM-DD" value={form.licenseExpiry} onChangeText={(v) => u('licenseExpiry', v)} icon="calendar-outline" />

            <View style={{ height: 12 }} />
            {sectionTitle('Sasakyan')}
            {selectGroup('Vehicle Type *', VEHICLE_TYPES, form.vehicleType, 'vehicleType')}
            <Input label="Plaka (Plate Number) *" placeholder="ABC 123" value={form.plateNo} onChangeText={(v) => u('plateNo', v)} icon="car-outline" error={errors.plateNo} />
            <Input label="Kulay (Color) (Optional)" placeholder="Puti / White" value={form.color} onChangeText={(v) => u('color', v)} icon="color-palette-outline" />
            <Input label="Seating Capacity (Optional)" placeholder="e.g. 18" value={form.seatingCapacity} onChangeText={(v) => u('seatingCapacity', v)} keyboardType="numeric" icon="people-outline" />

            <View style={{ height: 12 }} />
            {sectionTitle('Franchise / Operator')}
            <Text style={{ fontSize: 13, fontWeight: '600', color: C, marginBottom: 6 }}>Ruta (From - To) (Kailangan)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setShowTownPicker('from')} style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: errors.route ? '#EF4444' : bg }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: routeFrom ? C : G }}>{routeFrom || 'From'}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, color: G, alignSelf: 'center' }}>→</Text>
              <TouchableOpacity onPress={() => setShowTownPicker('to')} style={{ flex: 1, height: 52, borderRadius: 12, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: errors.route ? '#EF4444' : bg }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: routeTo ? C : G }}>{routeTo || 'To'}</Text>
              </TouchableOpacity>
            </View>
            {errors.route && <Text style={{ fontSize: 12, color: '#C0392B', marginTop: -12, marginBottom: 12, marginLeft: 4 }}>{errors.route}</Text>}
            {showTownPicker && (
              <View style={{ maxHeight: 200, marginBottom: 16, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAF0EC', overflow: 'hidden' }}>
                <ScrollView style={{ maxHeight: 200 }}>
                  {TOWNS.map((t) => {
                    const sameTown = showTownPicker === 'to' && t === routeFrom || showTownPicker === 'from' && t === routeTo;
                    return (
                    <TouchableOpacity key={t} onPress={() => {
                      if (sameTown) return;
                      if (showTownPicker === 'from') { setRouteFrom(t); setErrors((e) => ({ ...e, route: undefined })); }
                      else { setRouteTo(t); setErrors((e) => ({ ...e, route: undefined })); }
                      setShowTownPicker(null);
                    }}
                      style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EAF0EC', backgroundColor: (routeFrom === t || routeTo === t) ? B + '10' : 'transparent', opacity: sameTown ? 0.3 : 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, color: sameTown ? G : (routeFrom === t || routeTo === t) ? B : C }}>{t}</Text>
                        {(routeFrom === t || routeTo === t) && <Ionicons name="checkmark" size={18} color={B} />}
                      </View>
                    </TouchableOpacity>
                  )})}
                </ScrollView>
              </View>
            )}
            <Input label="LTFRB Franchise No." placeholder="Franchise number" value={form.franchiseNo} onChangeText={(v) => u('franchiseNo', v)} icon="document-text-outline" />
            <Input label="CPC Number" placeholder="CPC number" value={form.cpc} onChangeText={(v) => u('cpc', v)} icon="document-outline" />
            <Input label="Operator Name" placeholder="Name ng operator" value={form.operatorName} onChangeText={(v) => u('operatorName', v)} icon="person-outline" />

            <View style={{ height: 12 }} />
            {sectionTitle('Kumpanya (Kung Meron)')}
            <Input label="Company Name" placeholder="Hal. Golden Bee" value={form.companyName} onChangeText={(v) => u('companyName', v)} icon="business-outline" />
            <Input label="Contact Person" placeholder="Pangalan" value={form.contactPerson} onChangeText={(v) => u('contactPerson', v)} icon="people-outline" />
            <Input label="Contact Number" placeholder="0912 345 6789" value={form.contactNumber} onChangeText={(v) => u('contactNumber', v)} keyboardType="phone-pad" icon="call-outline" />

            <View style={{ height: 24 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {btn('Bumalik', prevStep, undefined, true)}
              {btn('Susunod', nextStep)}
            </View>
          </>}

          {/* STEP 3: Verification + Facial Recognition */}
          {step === 2 && <>
            {sectionTitle('Selfie verification')}
            <Text style={{ fontSize: 13, color: G, marginBottom: 12 }}>Kumuha ng selfie para sa identity verification</Text>
            
            <TouchableOpacity onPress={async () => {
              try {
              if (Platform.OS === 'web') { await pickDocument('selfie'); return; }
              const permission = await ImagePicker.requestCameraPermissionsAsync();
              if (!permission.granted) { showError('Camera permission is required for your selfie'); return; }
              const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
              if (!result.canceled && result.assets[0]?.base64) {
                const asset = result.assets[0];
                if (asset.base64!.length > 2500000) { showError('Selfie too large. Try a smaller image.'); return; }
                setDocs((p) => ({ ...p, selfie: { uri: asset.uri, name: 'selfie.jpg', base64: asset.base64!, mimeType: asset.mimeType || 'image/jpeg' } }));
              }
              } catch(e) { showError(e instanceof Error ? e.message : 'Unable to open camera'); }
            }} activeOpacity={0.8}
              style={{ backgroundColor: bg, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 2, borderColor: docs.selfie ? B : '#E5E7EB', borderStyle: docs.selfie ? 'solid' : 'dashed' }}>
              <View style={{ alignItems: 'center' }}>
                {docs.selfie ? (
                  <Ionicons name="checkmark-circle" size={48} color={B} />
                ) : (
                  <Ionicons name="camera" size={48} color={G} />
                )}
                <Text style={{ fontSize: 16, fontWeight: '700', color: docs.selfie ? B : C, marginTop: 8 }}>
                  {docs.selfie ? 'Selfie Taken!' : 'Take Selfie'}
                </Text>
                <Text style={{ fontSize: 13, color: G, marginTop: 4, textAlign: 'center' }}>
                  {docs.selfie ? 'Ready for admin review' : 'Tap to take a selfie for admin review'}
                </Text>
              </View>
            </TouchableOpacity>

            {sectionTitle('Documents')}
            <Text style={{ fontSize: 13, color: G, marginBottom: 12 }}>Mag-upload ng mga sumusunod na dokumento</Text>
            {docUpload('licenseFront', 'Drivers License (Harap)')}
            {docUpload('licenseBack', 'Drivers License (Likod)')}
            {docUpload('vehicleReg', 'Vehicle OR/CR')}

            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginTop: 12, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 13, color: '#D97706', lineHeight: 18 }}>Pagkatapos mag-register, kailangan ma-verify ng admin ang iyong account bago ka makapag-byahe. Ito ay para sa kaligtasan ng lahat.</Text>
              </View>
            </View>

            <View style={{ height: 24 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {btn('Bumalik', prevStep, undefined, true)}
              <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.85}
                style={{ flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: B, opacity: loading ? 0.7 : 1 }}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>I-submit</Text>}
              </TouchableOpacity>
            </View>
          </>}

          <View style={{ flexDirection: 'row', justifyContent: 'center', paddingTop: 24 }}>
            <Text style={{ fontSize: 15, color: G }}>May account na?{' '}</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: B }}>Mag Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {transitioning && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}><DotLoader color={B} size={12} /></View>}
    </SafeAreaView>
  );
}
