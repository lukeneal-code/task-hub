'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

/**
 * Loading spinner component.
 */
export default function LoadingSpinner({
  size = 'md',
  message,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div
        className={`spinner ${sizeClasses[size]}`}
        style={{
          borderWidth: size === 'lg' ? '4px' : '3px',
        }}
      />
      {message && <p className="mt-3 text-gray-600 text-sm">{message}</p>}
    </div>
  );
}
