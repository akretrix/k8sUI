import React from 'react';
import { LogoSymbol } from './LogoSymbol';

interface LogoLockupProps {
  className?: string;
  symbolSize?: number;
  showSubtitle?: boolean;
  subtitleText?: string;
  theme?: 'dark' | 'light';
}

export const LogoLockup: React.FC<LogoLockupProps> = ({
  className = '',
  symbolSize = 36,
  showSubtitle = true,
  subtitleText = 'Cluster Management',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  return (
    <div className={`inline-flex items-center space-x-3 select-none ${className}`}>
      <div className="shrink-0 flex items-center justify-center">
        <LogoSymbol size={symbolSize} hasGlow={isDark} />
      </div>
      <div className="flex flex-col justify-center">
        <div className="flex items-center space-x-1.5 leading-none">
          <span
            className={`font-bold tracking-tight text-lg font-mono ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            K8S<span className="text-[#326CE5]">UI</span>
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`text-[11px] font-medium tracking-wide mt-1 font-mono uppercase ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {subtitleText}
          </span>
        )}
      </div>
    </div>
  );
};
