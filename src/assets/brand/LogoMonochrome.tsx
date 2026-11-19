import React from 'react';

interface LogoMonochromeProps {
  className?: string;
  size?: number | string;
  color?: string;
}

export const LogoMonochrome: React.FC<LogoMonochromeProps> = ({
  className = '',
  size = 36,
  color = 'currentColor',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      className={className}
    >
      {/* Outer Hexagon */}
      <polygon
        points="256,64 422,160 422,352 256,448 90,352 90,160"
        strokeWidth="16"
        strokeLinejoin="round"
      />

      {/* 3-Axis Structural Spokes */}
      <g strokeWidth="14" strokeLinecap="round">
        <line x1="256" y1="68" x2="256" y2="136" />
        <line x1="94" y1="350" x2="152" y2="316" />
        <line x1="418" y1="350" x2="360" y2="316" />
      </g>

      {/* Isometric Cube Contour & Y-Bevel */}
      <polygon
        points="256,136 360,196 360,316 256,376 152,316 152,196"
        strokeWidth="16"
        strokeLinejoin="round"
      />
      <path
        d="M152,196 L256,256 L360,196 M256,256 L256,376"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Top-Right Status Node */}
      <circle cx="422" cy="160" r="22" fill={color} />
    </svg>
  );
};
