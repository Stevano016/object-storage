import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  /** Wraps the spinner in a centered block, for full-panel loading states. */
  block?: boolean;
  padding?: string;
}

export function Spinner({ size = 20, block = false, padding = '3rem' }: SpinnerProps) {
  const spinner = <Loader2 className="animate-spin" style={{ width: size, height: size }} />;

  if (!block) return spinner;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding }}>
      {spinner}
    </div>
  );
}
