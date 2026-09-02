import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number | string;
}

/**
 * 1. "No Clusters Connected" Illustration
 * An empty hexagonal dock waiting for a cluster link with orbiting placeholder nodes.
 */
export const NoClustersIllustration: React.FC<IllustrationProps> = ({
  className = '',
  size = 280,
}) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 300"
      width={size}
      height={typeof size === 'number' ? (size * 300) / 400 : size}
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id={`dockGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0B0F17" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id={`glowDock-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#326CE5" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#326CE5" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="200" cy="150" r="100" fill={`url(#glowDock-${id})`} />

      {/* Grid Floor */}
      <g stroke="#1F2937" strokeWidth="1" opacity="0.6">
        <line x1="80" y1="210" x2="320" y2="210" />
        <line x1="120" y1="240" x2="280" y2="240" />
        <line x1="140" y1="120" x2="80" y2="210" />
        <line x1="260" y1="120" x2="320" y2="210" />
      </g>

      {/* Isometric Dock Platform */}
      <polygon
        points="200,90 280,135 200,180 120,135"
        fill={`url(#dockGrad-${id})`}
        stroke="#326CE5"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <polygon
        points="120,135 200,180 200,195 120,150"
        fill="#0E1726"
        stroke="#326CE5"
        strokeWidth="1.5"
        opacity="0.7"
      />
      <polygon
        points="200,180 280,135 280,150 200,195"
        fill="#0B0F17"
        stroke="#326CE5"
        strokeWidth="1.5"
        opacity="0.7"
      />

      {/* Central Plus / Link Core (Waiting for Connection) */}
      <circle cx="200" cy="135" r="22" fill="#111827" stroke="#326CE5" strokeWidth="2.5" />
      <path
        d="M200,123 V147 M188,135 H212"
        stroke="#60A5FA"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Orbiting Empty Sockets */}
      <g stroke="#326CE5" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5">
        <circle cx="100" cy="80" r="12" />
        <circle cx="300" cy="80" r="12" />
        <circle cx="320" cy="200" r="12" />
        <circle cx="80" cy="200" r="12" />
        <line x1="112" y1="85" x2="178" y2="122" />
        <line x1="288" y1="85" x2="222" y2="122" />
      </g>
    </svg>
  );
};

/**
 * 2. "Pods Crashing / Alert State" Illustration
 * A broken isometric node showing warning indicators and pulse alert lines.
 */
export const CrashAlertIllustration: React.FC<IllustrationProps> = ({
  className = '',
  size = 280,
}) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 300"
      width={size}
      height={typeof size === 'number' ? (size * 300) / 400 : size}
      fill="none"
      className={className}
    >
      <defs>
        <radialGradient id={`redGlow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Red/Amber Glow */}
      <circle cx="200" cy="150" r="110" fill={`url(#redGlow-${id})`} />

      {/* Alert Radius Pulse Waves */}
      <circle cx="200" cy="140" r="70" stroke="#EF4444" strokeWidth="1" strokeDasharray="6 6" opacity="0.4" />
      <circle cx="200" cy="140" r="95" stroke="#F59E0B" strokeWidth="0.75" opacity="0.25" />

      {/* Fractured Isometric Cube Node (Left Half) */}
      <g transform="translate(-10, -4)">
        <polygon points="190,95 150,118 190,140 230,118" fill="#7F1D1D" stroke="#EF4444" strokeWidth="2" />
        <polygon points="150,118 190,140 190,195 150,172" fill="#450A0A" stroke="#EF4444" strokeWidth="2" />
      </g>

      {/* Fractured Isometric Cube Node (Right Displaced Half) */}
      <g transform="translate(14, 6)">
        <polygon points="210,105 250,82 290,105 250,128" fill="#991B1B" stroke="#F87171" strokeWidth="2" />
        <polygon points="250,128 290,105 290,160 250,182" fill="#7F1D1D" stroke="#F87171" strokeWidth="2" />
      </g>

      {/* Electric Spark / Crack Line */}
      <path
        d="M195,100 L205,120 L192,135 L215,155 L200,180"
        stroke="#FCD34D"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Crash Warning Floating Badges */}
      <g transform="translate(260, 60)">
        <polygon points="16,0 32,28 0,28" fill="#F59E0B" stroke="#78350F" strokeWidth="1.5" />
        <path d="M16,9 V17 M16,21 V23" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <g transform="translate(100, 150)">
        <circle cx="16" cy="16" r="16" fill="#EF4444" />
        <path d="M10,10 L22,22 M22,10 L10,22" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
};

/**
 * 3. "Deployment In Progress / Rolling Update" Illustration
 * Synchronized rotating gear/mesh nodes with progress paths.
 */
export const RollingUpdateIllustration: React.FC<IllustrationProps> = ({
  className = '',
  size = 280,
}) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 300"
      width={size}
      height={typeof size === 'number' ? (size * 300) / 400 : size}
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id={`blueGrad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#326CE5" />
        </linearGradient>
      </defs>

      {/* Dual Interlocking Transition Rings */}
      <circle cx="160" cy="150" r="55" stroke="#326CE5" strokeWidth="3" strokeDasharray="16 10" opacity="0.8" />
      <circle cx="240" cy="150" r="55" stroke="#10B981" strokeWidth="3" strokeDasharray="16 10" opacity="0.8" />

      {/* Transition Arrow Flow */}
      <path
        d="M160,95 C190,95 210,95 240,95"
        stroke="#60A5FA"
        strokeWidth="3"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <polygon points="245,95 235,90 235,100" fill="#60A5FA" />

      <path
        d="M240,205 C210,205 190,205 160,205"
        stroke="#34D399"
        strokeWidth="3"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <polygon points="155,205 165,200 165,210" fill="#34D399" />

      {/* Old Pod (Retiring) */}
      <g transform="translate(130, 120)">
        <rect width="60" height="60" rx="12" fill="#111827" stroke="#326CE5" strokeWidth="2" opacity="0.7" />
        <circle cx="30" cy="30" r="14" fill="#1E293B" />
        <path d="M24,30 H36" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* New Pod (Provisioning & Healthy) */}
      <g transform="translate(210, 120)">
        <rect width="60" height="60" rx="12" fill="#064E3B" stroke="#10B981" strokeWidth="2.5" />
        <circle cx="30" cy="30" r="14" fill="#047857" />
        <path d="M24,30 L28,34 L36,26" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

/**
 * 4. "All Systems Operational" Illustration
 * Glowing green node mesh with smooth signal paths.
 */
export const AllSystemsOperationalIllustration: React.FC<IllustrationProps> = ({
  className = '',
  size = 280,
}) => {
  const id = React.useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 300"
      width={size}
      height={typeof size === 'number' ? (size * 300) / 400 : size}
      fill="none"
      className={className}
    >
      <defs>
        <radialGradient id={`greenGlow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient Green Field */}
      <circle cx="200" cy="150" r="120" fill={`url(#greenGlow-${id})`} />

      {/* Hexagonal Mesh Network */}
      <polygon
        points="200,60 280,105 280,195 200,240 120,195 120,105"
        stroke="#10B981"
        strokeWidth="2"
        strokeDasharray="8 6"
        fill="#064E3B"
        fillOpacity="0.2"
      />

      {/* Internal High-Speed Data Highways */}
      <g stroke="#34D399" strokeWidth="2" opacity="0.8">
        <line x1="200" y1="60" x2="200" y2="150" />
        <line x1="280" y1="105" x2="200" y2="150" />
        <line x1="280" y1="195" x2="200" y2="150" />
        <line x1="200" y1="240" x2="200" y2="150" />
        <line x1="120" y1="195" x2="200" y2="150" />
        <line x1="120" y1="105" x2="200" y2="150" />
      </g>

      {/* Core Node Hub */}
      <circle cx="200" cy="150" r="26" fill="#111827" stroke="#10B981" strokeWidth="3" />
      <circle cx="200" cy="150" r="16" fill="#10B981" />
      <path d="M194,150 L198,154 L206,146" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Synchronized Satellite Node Cores */}
      <circle cx="200" cy="60" r="10" fill="#047857" stroke="#34D399" strokeWidth="2" />
      <circle cx="280" cy="105" r="10" fill="#047857" stroke="#34D399" strokeWidth="2" />
      <circle cx="280" cy="195" r="10" fill="#047857" stroke="#34D399" strokeWidth="2" />
      <circle cx="200" cy="240" r="10" fill="#047857" stroke="#34D399" strokeWidth="2" />
      <circle cx="120" cy="195" r="10" fill="#047857" stroke="#34D399" strokeWidth="2" />
      <circle cx="120" cy="105" r="10" fill="#047857" stroke="#34D399" strokeWidth="2" />
    </svg>
  );
};
