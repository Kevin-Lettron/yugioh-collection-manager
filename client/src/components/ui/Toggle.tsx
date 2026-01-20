import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  id,
  className = '',
}) => {
  const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? `${toggleId}-label` : undefined}
        id={toggleId}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span className="sr-only">{label || 'Toggle'}</span>
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
      {label && (
        <label
          id={`${toggleId}-label`}
          htmlFor={toggleId}
          className={`ml-3 text-sm font-medium text-gray-700 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={handleToggle}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default Toggle;
