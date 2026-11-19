import React from 'react';

interface LogoSymbolProps {
  className?: string;
  size?: number | string;
  hasGlow?: boolean;
  activeStatus?: boolean;
}

export const LogoSymbol: React.FC<LogoSymbolProps> = ({
  className = '',
  size = 48,
  hasGlow = true,
  activeStatus = true,
}) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      className={className}
    >
      <defs>
        {/* Outer Hexagon Frame Gradient */}
        <linearGradient id={`hexStroke-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#326CE5" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1D44A5" stopOpacity="0.35" />
        </linearGradient>

        {/* Isometric Cube Face Gradients */}
        <linearGradient id={`cubeTop-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="45%" stopColor="#326CE5" />
          <stop offset="100%" stopColor="#2557C7" />
        </linearGradient>

        <linearGradient id={`cubeLeft-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2557C7" />
          <stop offset="100%" stopColor="#143175" />
        </linearGradient>

        <linearGradient id={`cubeRight-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1D44A5" />
          <stop offset="100%" stopColor="#0B1736" />
        </linearGradient>

        {/* Specular Y-Axis Rim Light */}
        <linearGradient id={`rimLight-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.2" />
        </linearGradient>

        {/* Subtle Ambient Backdrop */}
        {hasGlow && (
          <radialGradient id={`ambient-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#326CE5" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#326CE5" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      {/* Subtle Ambient Aura */}
      {hasGlow && <circle cx="256" cy="256" r="190" fill={`url(#ambient-${id})`} />}

      {/* Outer Control-Plane Hexagon Frame */}
      <polygon
        points="256,64 422,160 422,352 256,448 90,352 90,160"
        fill="#326CE5"
        fillOpacity="0.05"
        stroke={`url(#hexStroke-${id})`}
        strokeWidth="10"
        strokeLinejoin="round"
      />

      {/* 3-Axis Structural Spokes (Kubernetes Helm Silhouette) */}
      <g stroke="#326CE5" strokeWidth="8" strokeOpacity="0.5" strokeLinecap="round">
        <line x1="256" y1="68" x2="256" y2="136" />
        <line x1="94" y1="350" x2="152" y2="316" />
        <line x1="418" y1="350" x2="360" y2="316" />
      </g>

      {/* Main Isometric Cluster Cube */}
      <g>
        {/* Top Face */}
        <polygon
          points="256,136 360,196 256,256 152,196"
          fill={`url(#cubeTop-${id})`}
        />
        {/* Left Face */}
        <polygon
          points="152,196 256,256 256,376 152,316"
          fill={`url(#cubeLeft-${id})`}
        />
        {/* Right Face */}
        <polygon
          points="256,256 360,196 360,316 256,376"
          fill={`url(#cubeRight-${id})`}
        />
        {/* Outer Cube Contour */}
        <polygon
          points="256,136 360,196 360,316 256,376 152,316 152,196"
          stroke="#60A5FA"
          strokeOpacity="0.55"
          strokeWidth="4"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Crisp Specular Y-Bevel */}
        <path
          d="M152,196 L256,256 L360,196 M256,256 L256,376"
          stroke={`url(#rimLight-${id})`}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Top-Right Active Status Node (Emerald) */}
      {activeStatus && (
        <g>
          <circle cx="422" cy="160" r="34" fill="#0B0F17" />
          <circle cx="422" cy="160" r="24" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="6" />
          <circle cx="422" cy="160" r="11" fill="#34D399" />
        </g>
      )}
    </svg>
  );
};
