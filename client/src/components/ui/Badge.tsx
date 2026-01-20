import React from 'react';

export type BanlistStatus = 'Forbidden' | 'Limited' | 'Semi-Limited' | 'Unlimited';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BanlistStatus | 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-semibold rounded-full border';

  const variantStyles = {
    Forbidden: 'bg-red-100 text-red-800 border-red-200',
    Limited: 'bg-orange-100 text-orange-800 border-orange-200',
    'Semi-Limited': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Unlimited: 'bg-green-100 text-green-800 border-green-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default Badge;
