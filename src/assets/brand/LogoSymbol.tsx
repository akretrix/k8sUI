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
        {/* Isometric Cube Face Gradients */}
        <linearGradient id={`cubeTop-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="50%" stopColor="#326CE5" />
          <stop offset="100%" stopColor="#2557C7" />
        </linearGradient>

        <linearGradient id={`cubeLeft-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2557C7" />
          <stop offset="100%" stopColor="#143175" />
        </linearGradient>

        <linearGradient id={`cubeRight-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1D44A5" />
          <stop offset="100%" stopColor="#0E214F" />
        </linearGradient>

        {/* Center Node Radial Glow */}
        <radialGradient id={`centerGlow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="50%" stopColor="#326CE5" />
          <stop offset="100%" stopColor="#326CE5" stopOpacity="0" />
        </radialGradient>

        {/* Filters */}
        {hasGlow && (
          <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Outer Hexagon Orbit Mesh */}
      <polygon
        points="256,92 398,174 398,338 256,420 114,338 114,174"
        stroke="#326CE5"
        strokeOpacity="0.4"
        strokeWidth="3"
        strokeDasharray="10 8"
        fill="none"
      />

      {/* Spokes connecting to vertices */}
      <g stroke="#326CE5" strokeWidth="2.5" strokeOpacity="0.6">
        <line x1="256" y1="92" x2="256" y2="150" />
        <line x1="398" y1="174" x2="348" y2="203" />
        <line x1="398" y1="338" x2="348" y2="309" />
        <line x1="256" y1="420" x2="256" y2="362" />
        <line x1="114" y1="338" x2="164" y2="309" />
        <line x1="114" y1="174" x2="164" y2="203" />
      </g>

      {/* Main Isometric Cluster Node */}
      <g filter={hasGlow ? `url(#glow-${id})` : undefined}>
        {/* Top Face */}
        <polygon
          points="256,150 348,203 256,256 164,203"
          fill={`url(#cubeTop-${id})`}
          stroke="#93C5FD"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Left Face */}
        <polygon
          points="164,203 256,256 256,362 164,309"
          fill={`url(#cubeLeft-${id})`}
          stroke="#326CE5"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Right Face */}
        <polygon
          points="256,256 348,203 348,309 256,362"
          fill={`url(#cubeRight-${id})`}
          stroke="#2557C7"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>

      {/* Surrounding Orbital Node Vertices */}
      {/* Top Node */}
      <circle cx="256" cy="92" r="14" fill="#0B0F17" stroke="#326CE5" strokeWidth="4" />
      <circle cx="256" cy="92" r="5" fill="#60A5FA" />

      {/* Bottom-Left Node */}
      <circle cx="114" cy="338" r="14" fill="#0B0F17" stroke="#326CE5" strokeWidth="4" />
      <circle cx="114" cy="338" r="5" fill="#60A5FA" />

      {/* Bottom-Right Node */}
      <circle cx="398" cy="338" r="14" fill="#0B0F17" stroke="#326CE5" strokeWidth="4" />
      <circle cx="398" cy="338" r="5" fill="#60A5FA" />

      {/* Left Vertex Node */}
      <circle cx="114" cy="174" r="12" fill="#0B0F17" stroke="#326CE5" strokeWidth="3" />
      <circle cx="114" cy="174" r="4" fill="#60A5FA" />

      {/* Bottom Center Node */}
      <circle cx="256" cy="420" r="12" fill="#0B0F17" stroke="#326CE5" strokeWidth="3" />
      <circle cx="256" cy="420" r="4" fill="#60A5FA" />

      {/* Top-Right Active Status Node */}
      {activeStatus && (
        <>
          <circle cx="398" cy="174" r="16" fill="#0B0F17" stroke="#10B981" strokeWidth="4" />
          <circle cx="398" cy="174" r="7" fill="#34D399" filter={hasGlow ? `url(#glow-${id})` : undefined} />
        </>
      )}

      {/* Center Core Glowing Heart */}
      <circle cx="256" cy="203" r="16" fill={`url(#centerGlow-${id})`} />
      <circle cx="256" cy="203" r="6" fill="#FFFFFF" />
    </svg>
  );
};
