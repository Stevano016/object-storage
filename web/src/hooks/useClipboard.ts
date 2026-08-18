import { useCallback } from 'react';
import { copyText } from '../lib/clipboard';
import { useToast } from '../context/ToastContext';

export function useClipboard() {
  const { showToast } = useToast();

  return useCallback(async (text: string) => {
    const copied = await copyText(text);
    showToast(
      copied ? 'Disalin ke clipboard.' : 'Gagal menyalin. Salin manual dari kotak teks.',
      copied ? 'success' : 'error'
    );
  }, [showToast]);
}
