import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '', filled = false }) => {
  return (
    <span 
      className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`}
      style={{ fontSize: `${size}px` }}
    >
      {name}
    </span>
  );
};