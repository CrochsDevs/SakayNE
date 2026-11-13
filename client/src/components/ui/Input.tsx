import { useState } from 'react';
import { TextInput, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DarkColors } from '@/src/constants/Colors';
import { useTheme } from '@/src/store/theme';
import { scale, verticalScale, moderateScale } from '@/src/utils/responsive';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  secureTextEntry?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  darkTheme?: boolean;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  icon,
  error,
  autoCapitalize = 'none',
  editable = true,
  darkTheme,
}: InputProps) {
  const theme = useTheme();
  const Colors = darkTheme ? DarkColors : theme.colors;
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const textColor = Colors.text;
  const placeholderColor = Colors.textTertiary;
  const iconColor = Colors.textSecondary;
  const iconColorFocused = Colors.primaryLight;

  return (
    <View style={{ width: '100%', marginBottom: verticalScale(16) }}>
      {label && (
        <Text style={{ fontSize: moderateScale(14), fontWeight: '600', marginBottom: verticalScale(6), color: textColor }}>
          {label}
        </Text>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center', borderRadius: scale(16),
        paddingHorizontal: scale(16), backgroundColor: Colors.card,
        borderWidth: 1.5, borderColor: error ? Colors.error : isFocused ? Colors.borderFocused : Colors.border, minHeight: 52, height: verticalScale(54),
      }}>
        {icon && (
          <Ionicons
            name={icon}
            size={moderateScale(20)}
            color={isFocused ? iconColorFocused : iconColor}
            style={{ marginRight: scale(12) }}
          />
        )}
        <TextInput
          style={{
            flex: 1, fontSize: moderateScale(16), color: textColor,
            padding: 0, borderWidth: 0, backgroundColor: 'transparent',
          }}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={isSecure}
          autoCapitalize={autoCapitalize}
          editable={editable}
          underlineColorAndroid="transparent"
          textContentType={secureTextEntry ? "password" : "none"}
          autoComplete={secureTextEntry ? "password" : "off"}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setIsSecure(!isSecure)} hitSlop={8}>
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={moderateScale(20)}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={{ fontSize: moderateScale(12), marginTop: verticalScale(4), marginLeft: scale(4), color: Colors.error }}>
          {error}
        </Text>
      )}
    </View>
  );
}
