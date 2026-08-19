import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 'current-password' when signing in, 'new-password' when setting one. */
  autoComplete?: string;
  /** Marks the field as rejected so the border matches the message below it. */
  invalid?: boolean;
}

/**
 * A password field with a reveal toggle.
 *
 * The password rules here are strict enough that typing blind is a real source
 * of mistakes, and letting someone check what they typed beats letting them
 * paste into a text field to see it. The visible state is deliberately not
 * remembered between renders of a form — it resets closed every time.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className={`password-field${invalid ? ' has-error' : ''}`}>
      <input
        className="form-input"
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
      />
      <button
        className="password-toggle"
        type="button"
        onClick={() => setVisible(current => !current)}
        // Both attributes: the title is the hover hint, aria-label is what a
        // screen reader announces for a button with no text.
        title={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
        aria-pressed={visible}
        // Skipped in tab order so Tab still goes straight to the next field.
        tabIndex={-1}
      >
        <Icon style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}
