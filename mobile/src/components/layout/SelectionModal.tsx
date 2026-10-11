import { Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { PropsWithChildren } from 'react';
import { styles } from './SelectionModal.styles';

export function SelectionModal({
  visible,
  onClose,
  children,
}: PropsWithChildren<{ visible: boolean; onClose: () => void }>) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        {visible && <StatusBar style="dark" />}
        <SafeAreaView
          style={styles.safe}
          edges={{ top: 'maximum', bottom: 'additive', left: 'additive', right: 'additive' }}
        >
          {children}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
