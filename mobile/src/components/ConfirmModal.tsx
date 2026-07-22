import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';

export type ConfirmModalType = 'primary' | 'success' | 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  hideCancelButton?: boolean;
  type?: ConfirmModalType;
  icon?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Đồng ý',
  cancelText = 'Hủy',
  hideCancelButton = false,
  type,
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!visible) return null;

  // Auto-infer modal type and icon if not provided
  const inferTypeAndIcon = (): { resolvedType: ConfirmModalType; resolvedIcon: string } => {
    const titleLower = (title || '').toLowerCase();
    const msgLower = (message || '').toLowerCase();
    const combined = `${titleLower} ${msgLower}`;

    if (type) {
      const defaultIconMap: Record<ConfirmModalType, string> = {
        danger: '❌',
        warning: '⚠️',
        success: '✅',
        info: '🔔',
        primary: '💳',
      };
      return { resolvedType: type, resolvedIcon: icon || defaultIconMap[type] };
    }

    if (combined.includes('lỗi') || combined.includes('thất bại') || combined.includes('hết hạn') || combined.includes('chặn')) {
      return { resolvedType: 'danger', resolvedIcon: icon || '❌' };
    }
    if (combined.includes('thành công') || combined.includes('hoàn thành')) {
      return { resolvedType: 'success', resolvedIcon: icon || '✅' };
    }
    if (combined.includes('in') || combined.includes('máy in')) {
      return { resolvedType: 'info', resolvedIcon: icon || '🖨️' };
    }
    if (combined.includes('hóa đơn') || combined.includes('xuất')) {
      return { resolvedType: 'primary', resolvedIcon: icon || '🧾' };
    }
    if (combined.includes('thu tiền') || combined.includes('thanh toán')) {
      return { resolvedType: 'success', resolvedIcon: icon || '💰' };
    }

    return { resolvedType: 'info', resolvedIcon: icon || '🔔' };
  };

  const { resolvedType, resolvedIcon } = inferTypeAndIcon();

  const getTypeStyles = () => {
    switch (resolvedType) {
      case 'danger':
        return {
          iconBg: '#ffe4e6',
          iconColor: '#e11d48',
          btnBg: '#e11d48',
          btnPressBg: '#be123c',
        };
      case 'warning':
        return {
          iconBg: '#fef3c7',
          iconColor: '#d97706',
          btnBg: '#d97706',
          btnPressBg: '#b45309',
        };
      case 'success':
        return {
          iconBg: '#dcfce7',
          iconColor: '#166534',
          btnBg: '#16a34a',
          btnPressBg: '#15803d',
        };
      case 'info':
        return {
          iconBg: '#dbeafe',
          iconColor: '#1d4ed8',
          btnBg: '#2563eb',
          btnPressBg: '#1d4ed8',
        };
      case 'primary':
      default:
        return {
          iconBg: '#e6f4ea',
          iconColor: '#0d8a6a',
          btnBg: '#0d8a6a',
          btnPressBg: '#0b6e54',
        };
    }
  };

  const currentType = getTypeStyles();
  const showCancel = !hideCancelButton && cancelText !== null && cancelText !== '';
  const handleClose = onCancel || onConfirm;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPress} onPress={loading ? undefined : handleClose} />

        <View style={styles.container}>
          {/* Header Icon Circle */}
          <View style={[styles.iconCircle, { backgroundColor: currentType.iconBg }]}>
            <Text style={styles.iconText}>{resolvedIcon}</Text>
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {showCancel && (
              <Pressable
                disabled={loading}
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>
            )}

            <Pressable
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                !showCancel && styles.fullWidthButton,
                { backgroundColor: pressed ? currentType.btnPressBg : currentType.btnBg },
                loading && styles.buttonDisabled,
              ]}>
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmText}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 28,
    lineHeight: 32,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flex: 1.2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  fullWidthButton: {
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
