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
        points="256,92 398,174 398,338 256,420 114,338 114,174"
        strokeWidth="12"
        strokeDasharray="14 10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Internal Spokes */}
      <g strokeWidth="10" strokeLinecap="round">
        <line x1="256" y1="92" x2="256" y2="150" />
        <line x1="398" y1="174" x2="348" y2="203" />
        <line x1="398" y1="338" x2="348" y2="309" />
        <line x1="256" y1="420" x2="256" y2="362" />
        <line x1="114" y1="338" x2="164" y2="309" />
        <line x1="114" y1="174" x2="164" y2="203" />
      </g>

      {/* Isometric Cube Faces */}
      <polygon
        points="256,150 348,203 256,256 164,203"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <polygon
        points="164,203 256,256 256,362 164,309"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <polygon
        points="256,256 348,203 348,309 256,362"
        strokeWidth="12"
        strokeLinejoin="round"
      />

      {/* Vertex Nodes */}
      <circle cx="256" cy="92" r="16" fill={color} />
      <circle cx="398" cy="174" r="18" fill={color} />
      <circle cx="398" cy="338" r="16" fill={color} />
      <circle cx="256" cy="420" r="16" fill={color} />
      <circle cx="114" cy="338" r="16" fill={color} />
      <circle cx="114" cy="174" r="16" fill={color} />

      {/* Center Heart Dot */}
      <circle cx="256" cy="203" r="14" fill={color} />
    </svg>
  );
};
