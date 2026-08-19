import { AlertCircle } from 'lucide-react';

/**
 * The inline replacement for the browser's validation bubble.
 *
 * Renders nothing when there is no message, so a form can hand it a possibly
 * empty error without wrapping every use in a conditional. `role="alert"` makes
 * a screen reader announce the message the moment it appears, which is the one
 * thing the native bubble did well.
 */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <p className="field-error" role="alert">
      <AlertCircle className="field-error-icon" />
      {message}
    </p>
  );
}
