import { useEffect, useState } from 'react';
import { heicPreviewUrl, isHeicFile, VIEWER_MAX_EDGE } from '../lib/heic';
import type { FileItem } from '../types';

interface HeicPreview {
  /** The URL to render: the decoded JPEG, or the original when no decoding is needed. */
  src: string;
  decoding: boolean;
  error: string | null;
  /** True when this file needed the decoder at all. */
  isHeic: boolean;
}

/**
 * Gives a component a renderable URL for an image, decoding HEIC on the way.
 *
 * Non-HEIC files pass straight through, so a caller can use this for every image
 * without branching. Decoding is queued globally (see lib/heic), so a grid of
 * photos resolves one after another instead of all at once.
 */
export function useHeicPreview(
  file: FileItem,
  sourceUrl: string,
  maxEdge: number = VIEWER_MAX_EDGE
): HeicPreview {
  const isHeic = isHeicFile(file.mimeType, file.originalName);

  const [src, setSrc] = useState(isHeic ? '' : sourceUrl);
  const [decoding, setDecoding] = useState(isHeic);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHeic) {
      setSrc(sourceUrl);
      setDecoding(false);
      setError(null);
      return;
    }

    // Guards against a result arriving after the user has moved on, which would
    // otherwise set state on an unmounted component or show the wrong photo.
    let active = true;
    setDecoding(true);
    setError(null);

    heicPreviewUrl(file.id, sourceUrl, maxEdge)
      .then(url => { if (active) { setSrc(url); setDecoding(false); } })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error && cause.message ? cause.message : 'Gagal membaca berkas HEIC.');
        setDecoding(false);
      });

    return () => { active = false; };
  }, [file.id, sourceUrl, isHeic, maxEdge]);

  return { src, decoding, error, isHeic };
}
