/**
 * Utilities for cleaning Kubernetes cluster names and generating
 * distinctive 4-letter visual monograms for multi-cluster workspaces.
 */

/**
 * Extracts a human-friendly leaf cluster name from full ARNs, URIs, or provider prefixes.
 * Examples:
 *   "arn:aws:eks:region:111122223333:cluster/prod-workloads-cluster" -> "prod-workloads-cluster"
 *   "eks:demo-production-cluster" -> "demo-production-cluster"
 *   "https://kubernetes.default.svc.cluster.local" -> "kubernetes-default"
 */
export function cleanClusterName(rawName?: string): string {
  if (!rawName) return 'Cluster';

  let cleaned = rawName.trim();

  // If it's an ARN (e.g. arn:aws:eks:...:cluster/my-cluster-name)
  if (cleaned.startsWith('arn:aws:eks') || cleaned.includes(':cluster/')) {
    const parts = cleaned.split(':cluster/');
    if (parts.length > 1 && parts[1]) {
      cleaned = parts[1];
    } else {
      const slashParts = cleaned.split('/');
      cleaned = slashParts[slashParts.length - 1] || cleaned;
    }
  }

  // Strip common provider prefixes like "eks:" or "aks:" or "gke:" or "local:"
  cleaned = cleaned.replace(/^(eks|aks|gke|local):/i, '');

  return cleaned || rawName;
}

/**
 * Generates an uppercase 4-letter monogram from a cluster name.
 * Examples:
 *   "prod-workloads-cluster"  -> "PWKL"
 *   "prod-payment-service"    -> "PPAY"
 *   "staging-api-gateway"     -> "STAG"
 *   "dev-frontend-app"        -> "DFRN"
 *   "docker-desktop"          -> "DOCK"
 *   "minikube"                -> "MINI"
 *   "kind-local"              -> "KIND"
 */
export function getClusterMonogram(rawName?: string): string {
  const name = cleanClusterName(rawName).toLowerCase();
  if (!name || name === 'cluster') return 'CLST';

  // Split by non-alphanumeric separators
  const parts = name.split(/[-_.\s]+/).filter(Boolean);

  if (parts.length === 0) return 'CLST';

  // Single word: take first 4 characters
  if (parts.length === 1) {
    const single = parts[0].replace(/[^a-z0-9]/g, '');
    return single.slice(0, 4).toUpperCase().padEnd(4, 'X');
  }

  const [first, second, third, fourth] = parts;

  // Pattern: environment prefix like pdn/dev/stg/qa/prd
  const isEnvPrefix = /^(pdn|prd|prod|dev|stg|stage|staging|qa|uat|test|lab|local)$/.test(first);

  if (isEnvPrefix && second) {
    const envChar = first[0]; // e.g. 'p' for pdn
    const cleanSecond = second.replace(/[^a-z0-9]/g, '');

    // e.g. dev-api -> D + API = DAPI
    if (cleanSecond.length <= 3) {
      return (envChar + cleanSecond).toUpperCase().padEnd(4, 'X');
    }

    // e.g. prod-workloads -> P + WRL = PWRL
    const secondConsonants = cleanSecond.replace(/[aeiou]/g, '');
    const candidate = secondConsonants.length >= 3 ? secondConsonants.slice(0, 3) : cleanSecond.slice(0, 3);
    return (envChar + candidate).toUpperCase();
  }

  // 2 significant parts: e.g. core-engine -> CO + EN = COEN
  if (parts.length === 2) {
    const p1 = first.slice(0, 2);
    const p2 = second.slice(0, 2);
    return (p1 + p2).toUpperCase();
  }

  // 3 parts: e.g. demo-app-cluster -> DE + A + C
  if (parts.length === 3) {
    return (first.slice(0, 2) + second[0] + third[0]).toUpperCase();
  }

  // 4+ parts: take first letter of each of the first 4 parts
  return [first[0], second[0], third[0], fourth[0]].join('').toUpperCase();
}

export interface EnvironmentVisuals {
  label: 'PROD' | 'STG' | 'DEV' | 'LOC';
  badgeClass: string;
  ringClass: string;
  activeRingClass: string;
  glowClass: string;
  textColor: string;
  dotColor: string;
}

/**
 * Returns consistent, vivid visual styles for an environment tier.
 */
export function getEnvironmentVisuals(environment?: string): EnvironmentVisuals {
  const env = (environment || '').toLowerCase();

  if (env.includes('prod') || env.includes('pdn')) {
    return {
      label: 'PROD',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-500/50',
      ringClass: 'border-red-600/70 hover:border-red-400 bg-red-950/30',
      activeRingClass: 'border-red-500 ring-2 ring-red-500/40 bg-red-950/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]',
      glowClass: 'shadow-[0_0_12px_rgba(239,68,68,0.35)]',
      textColor: 'text-red-300',
      dotColor: 'bg-red-500',
    };
  }

  if (env.includes('stag') || env.includes('stg') || env.includes('qa') || env.includes('uat')) {
    return {
      label: 'STG',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
      ringClass: 'border-amber-600/70 hover:border-amber-400 bg-amber-950/30',
      activeRingClass: 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-950/60 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
      glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]',
      textColor: 'text-amber-300',
      dotColor: 'bg-amber-500',
    };
  }

  if (env.includes('local') || env.includes('kind') || env.includes('minikube')) {
    return {
      label: 'LOC',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
      ringClass: 'border-sky-600/70 hover:border-sky-400 bg-sky-950/30',
      activeRingClass: 'border-sky-500 ring-2 ring-sky-500/40 bg-sky-950/60 shadow-[0_0_15px_rgba(14,165,233,0.4)]',
      glowClass: 'shadow-[0_0_12px_rgba(14,165,233,0.35)]',
      textColor: 'text-sky-300',
      dotColor: 'bg-sky-500',
    };
  }

  // Development default
  return {
    label: 'DEV',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    ringClass: 'border-emerald-600/70 hover:border-emerald-400 bg-emerald-950/30',
    activeRingClass: 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-950/60 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]',
    textColor: 'text-emerald-300',
    dotColor: 'bg-emerald-500',
  };
}
