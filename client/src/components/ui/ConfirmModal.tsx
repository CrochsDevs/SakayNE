import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/store/theme';

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
  const { colors } = useTheme();
  const iconName = type === 'warning' ? 'alert-circle' : type === 'success' ? 'checkmark-circle' : 'information-circle';
  const iconColor = type === 'warning' ? '#C0392B' : type === 'success' ? '#087F8C' : '#3B82F6';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: colors.card, borderRadius: 26, padding: 28, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: type === 'warning' ? '#FEF2F2' : '#E5F5F1', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name={iconName} size={32} color={iconColor} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 }}>{title}</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7}
              style={{ flex: 1, height: 48, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundAlt }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} activeOpacity={0.85}
              style={{ flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: type === 'warning' ? '#C0392B' : '#087F8C' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
