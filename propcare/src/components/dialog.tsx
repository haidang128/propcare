/**
 * Cross-platform confirm/alert. Mirrors the `Alert.alert(title, message, buttons)`
 * API so call sites read the same on every platform — but unlike react-native-web's
 * `Alert` (a no-op), this renders a branded in-app modal so confirmations and error
 * messages actually work on web. Native gets the same modal for a consistent look.
 *
 * Mount <DialogHost /> once at the app root, then call showDialog(...) from anywhere.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

export type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type DialogConfig = {
  title: string;
  message?: string;
  buttons: DialogButton[];
};

let enqueue: ((config: DialogConfig) => void) | null = null;

/** Drop-in replacement for Alert.alert. Defaults to a single "OK" button. */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  const config: DialogConfig = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
  };
  if (enqueue) {
    enqueue(config);
  } else if (typeof window !== 'undefined') {
    // Host not mounted yet — degrade to a browser dialog rather than losing the message.
    window.alert([title, message].filter(Boolean).join('\n\n'));
    config.buttons.find((b) => b.style !== 'cancel')?.onPress?.();
  }
}

export function DialogHost() {
  const { colors: c } = usePalette();
  const [queue, setQueue] = useState<DialogConfig[]>([]);
  const current = queue[0];

  useEffect(() => {
    enqueue = (config) => setQueue((q) => [...q, config]);
    return () => {
      enqueue = null;
    };
  }, []);

  function dismiss(button?: DialogButton) {
    setQueue((q) => q.slice(1));
    button?.onPress?.();
  }

  if (!current) return null;

  const stacked = current.buttons.length > 2;
  const cancelButton = current.buttons.find((b) => b.style === 'cancel');

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      // Android hardware back / Esc — treat as cancel.
      onRequestClose={() => dismiss(cancelButton)}>
      <Pressable style={styles.backdrop} onPress={() => dismiss(cancelButton)}>
        {/* Swallow taps on the card so they don't dismiss the dialog. */}
        <Pressable
          style={[styles.card, { backgroundColor: c.backgroundElement }]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: c.text }]}>{current.title}</Text>
          {current.message ? (
            <ScrollView style={styles.messageScroll} contentContainerStyle={{ flexGrow: 1 }}>
              <Text style={[styles.message, { color: c.textSecondary }]}>{current.message}</Text>
            </ScrollView>
          ) : null}
          <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
            {current.buttons.map((button, i) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';
              const tint = isDestructive ? '#B3261E' : isCancel ? c.textSecondary : c.primary;
              return (
                <Pressable
                  key={`${button.text}-${i}`}
                  onPress={() => dismiss(button)}
                  style={({ pressed }) => [
                    styles.button,
                    stacked && styles.buttonStackedItem,
                    { borderColor: c.border },
                    pressed && { backgroundColor: c.backgroundSelected },
                  ]}>
                  <Text
                    style={[
                      styles.buttonText,
                      { color: tint, fontFamily: isCancel ? Fonts.medium : Fonts.bold },
                    ]}>
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,32,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    padding: 20,
    gap: 12,
    boxShadow: '0 12px 40px rgba(15,23,32,0.28)',
  },
  title: { fontSize: 17, fontFamily: Fonts.bold },
  messageScroll: { maxHeight: 220 },
  message: { fontSize: 14.5, lineHeight: 21 },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  buttonColumn: {
    flexDirection: 'column-reverse',
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonStackedItem: {
    flex: 0,
    width: '100%',
  },
  buttonText: { fontSize: 15 },
});
