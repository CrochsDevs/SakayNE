import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'success' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible, title, message,
  confirmText = 'Confirm', cancelText = 'Cancel',
  type = 'warning', onConfirm, onCancel,
}: ConfirmModalProps) {
  const iconName = type === 'warning' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle';
  const iconColor = type === 'warning' ? '#C0392B' : type === 'success' ? '#3F8451' : '#3B82F6';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: type === 'warning' ? '#FEF2F2' : '#F0F7F1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name={iconName} size={32} color={iconColor} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0D1F16', textAlign: 'center', marginBottom: 8 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7}
              style={{ flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7F5' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#6B7280' }}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} activeOpacity={0.85}
              style={{ flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: type === 'warning' ? '#C0392B' : '#3F8451' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
