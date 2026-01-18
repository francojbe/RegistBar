import React from 'react';

interface SpinnerProps {
    size?: number;
    color?: string;
    className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
    size = 48,
    color = 'currentColor',
    className = ''
}) => {
    return (
        <svg
            className={`animate-spin ${className}`}
            width={size}
            height={size}
            viewBox="0 0 50 50"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-primary, #a855f7)" stopOpacity="1" />
                    <stop offset="50%" stopColor="var(--color-accent, #22d3ee)" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="var(--color-primary, #a855f7)" stopOpacity="0" />
                </linearGradient>
            </defs>
            <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="url(#spinnerGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="80, 200"
                strokeDashoffset="0"
            />
        </svg>
    );
};

// Small spinner for buttons
export const SpinnerSmall: React.FC<{ className?: string }> = ({ className = '' }) => {
    return (
        <svg
            className={`animate-spin ${className}`}
            width={24}
            height={24}
            viewBox="0 0 50 50"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="80, 200"
                strokeDashoffset="0"
                opacity="0.25"
            />
            <circle
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="40, 200"
                strokeDashoffset="0"
            />
        </svg>
    );
};
