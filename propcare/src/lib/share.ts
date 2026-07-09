/**
 * Cross-platform sharing. react-native-web's `Share.share()` only works when the
 * browser exposes the Web Share API (mostly mobile); on every other browser it
 * rejects with "Share is not supported". These helpers give a graceful web path
 * — the native share sheet on iOS/Android, the Web Share API when present, and a
 * clipboard copy (or file download) as the fallback.
 */
import { Platform, Share } from 'react-native';

import { showDialog } from '@/components/dialog';

/** Share (or, on desktop web, copy) a piece of text. */
export async function shareText(
  message: string,
  opts?: { title?: string; copiedTitle?: string },
) {
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ message, title: opts?.title });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
    return;
  }

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav?.share) {
    try {
      await nav.share({ title: opts?.title, text: message });
      return;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // user cancelled
      // otherwise fall through to the clipboard path
    }
  }

  try {
    await nav?.clipboard?.writeText(message);
    showDialog(
      opts?.copiedTitle ?? 'Copied to clipboard',
      'Your browser can’t open a share sheet, so we copied this instead — paste it wherever you need it.',
    );
  } catch {
    // clipboard blocked — show the text so it can be copied by hand
    showDialog(opts?.copiedTitle ?? 'Copy this', message);
  }
}

/** Trigger a browser file download (web only). */
export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
