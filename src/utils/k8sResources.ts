/**
 * Kubernetes Resource Quantity Parser & Workload Capacity Engine
 *
 * Implements standard Kubernetes quantity parsing (CPU millicores, Memory MiB/GiB),
 * aggregate Pod totals, QoS classification (Guaranteed, Burstable, BestEffort),
 * and Multi-Replica Deployment Cluster Footprint scaling.
 */

export interface ParsedContainerResource {
  name: string;
  cpuRequest: number; // in millicores (m)
  cpuRequestFormatted: string;
  cpuLimit: number; // in millicores (m)
  cpuLimitFormatted: string;
  hasCpuRequest: boolean;
  hasCpuLimit: boolean;

  memRequest: number; // in MiB
  memRequestFormatted: string;
  memoryRequestFormatted: string; // alias
  memLimit: number; // in MiB
  memLimitFormatted: string;
  memoryLimitFormatted: string; // alias
  hasMemRequest: boolean;
  hasMemLimit: boolean;
  hasMemoryLimit: boolean; // alias
}

export interface WorkloadResourceSummary {
  containers: ParsedContainerResource[];

  // Aggregated Pod-level resources
  totalCpuRequest: number; // millicores
  totalCpuRequestFormatted: string;
  totalCpuLimit: number; // millicores
  totalCpuLimitFormatted: string;
  hasTotalCpuLimit: boolean;
  hasUncappedCpuLimit: boolean; // true if any container lacks a CPU limit
  hasTotalCpuRequest: boolean;

  totalMemRequest: number; // MiB
  totalMemRequestFormatted: string;
  totalMemoryRequestFormatted: string; // alias
  totalMemLimit: number; // MiB
  totalMemoryLimit: number; // MiB alias
  totalMemLimitFormatted: string;
  totalMemoryLimitFormatted: string; // alias
  hasTotalMemLimit: boolean;
  hasUncappedMemoryLimit: boolean; // true if any container lacks a memory limit
  hasTotalMemRequest: boolean;

  // Official Kubernetes QoS tier
  qosClass: 'Guaranteed' | 'Burstable' | 'BestEffort';

  // Scaled Multi-Replica Cluster Footprint (e.g. for Deployments)
  replicas: number;
  scaledCpuRequest: number;
  scaledCpuRequestFormatted: string;
  scaledCpuLimit: number;
  scaledCpuLimitFormatted: string;
  scaledMemRequest: number;
  scaledMemRequestFormatted: string;
  scaledMemoryRequestFormatted: string; // alias
  scaledMemLimit: number;
  scaledMemLimitFormatted: string;
  scaledMemoryLimitFormatted: string; // alias
}

/**
 * Parses a Kubernetes CPU quantity string or number into millicores (m).
 * Examples:
 *  - "100m" -> 100
 *  - "0.5" -> 500
 *  - "1" -> 1000
 *  - "2.5" -> 2500
 *  - "500000u" -> 500
 *  - "1000000000n" -> 1000
 */
export function parseCpuQuantity(val?: string | number | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val * 1000);
  }

  const str = String(val).trim();
  if (!str) return 0;

  if (str.endsWith('m')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num);
  }

  if (str.endsWith('u')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num / 1000);
  }

  if (str.endsWith('n')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : Math.round(num / 1000000);
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 1000);
}

/**
 * Formats millicores into a clean Kubernetes-friendly string.
 * Examples:
 *  - 100 -> "100m"
 *  - 1000 -> "1.00 cores"
 *  - 2500 -> "2.50 cores"
 *  - 0 -> "None"
 */
export function formatCpuQuantity(millicores: number): string {
  if (millicores <= 0) return 'None';
  if (millicores >= 1000) {
    const cores = millicores / 1000;
    const str = cores.toFixed(2);
    const cleaned = str.endsWith('0') ? str.slice(0, -1) : str;
    return `${cleaned} cores`;
  }
  return `${Math.round(millicores)}m`;
}

/**
 * Parses a Kubernetes Memory quantity string or number into MiB.
 * Examples:
 *  - "128Mi" -> 128
 *  - "1Gi" -> 1024
 *  - "512M" -> ~488
 *  - "1048576" (bytes) -> 1
 */
export function parseMemoryQuantity(val?: string | number | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val / (1024 * 1024);
  }

  const str = String(val).trim();
  if (!str) return 0;

  // Binary SI
  if (str.endsWith('Ki')) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num / 1024;
  }
  if (str.endsWith('Mi')) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num;
  }
  if (str.endsWith('Gi')) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * 1024;
  }
  if (str.endsWith('Ti')) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * 1024 * 1024;
  }
  if (str.endsWith('Pi')) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * 1024 * 1024 * 1024;
  }

  // Decimal SI
  if (str.endsWith('k') || str.endsWith('K')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : (num * 1000) / (1024 * 1024);
  }
  if (str.endsWith('M')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : (num * 1000 * 1000) / (1024 * 1024);
  }
  if (str.endsWith('G')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : (num * 1000 * 1000 * 1000) / (1024 * 1024);
  }
  if (str.endsWith('T')) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : (num * 1000 * 1000 * 1000 * 1000) / (1024 * 1024);
  }

  // Raw bytes
  const bytes = parseFloat(str);
  return isNaN(bytes) ? 0 : bytes / (1024 * 1024);
}

/**
 * Formats MiB into a clean human-readable Kubernetes memory string.
 * Examples:
 *  - 128 -> "128 MiB"
 *  - 1024 -> "1.0 GiB"
 *  - 2560 -> "2.5 GiB"
 *  - 0 -> "None"
 */
export function formatMemoryQuantity(mib: number): string {
  if (mib <= 0) return 'None';
  if (mib >= 1024) {
    const gib = mib / 1024;
    return `${gib.toFixed(1)} GiB`;
  }
  return `${Math.round(mib)} MiB`;
}

/**
 * Calculates complete resource requests, limits, QoS class, and scaled cluster footprint.
 */
export function calculateWorkloadResources(
  containers: any[] = [],
  replicas: number = 1
): WorkloadResourceSummary {
  const safeReplicas = Math.max(1, isNaN(replicas) ? 1 : replicas);
  const parsedContainers: ParsedContainerResource[] = [];

  let totalCpuRequest = 0;
  let totalCpuLimit = 0;
  let allHaveCpuLimit = containers.length > 0;
  let anyHaveCpuRequest = false;

  let totalMemRequest = 0;
  let totalMemLimit = 0;
  let allHaveMemLimit = containers.length > 0;
  let anyHaveMemRequest = false;

  let allGuaranteed = containers.length > 0;

  for (const c of containers) {
    const resources = c.resources || {};
    const requests = resources.requests || {};
    const limits = resources.limits || {};

    const hasCpuReq = requests.cpu !== undefined && requests.cpu !== null && requests.cpu !== '';
    const hasCpuLim = limits.cpu !== undefined && limits.cpu !== null && limits.cpu !== '';
    const cpuReq = parseCpuQuantity(requests.cpu);
    const cpuLim = parseCpuQuantity(limits.cpu);

    const hasMemReq = requests.memory !== undefined && requests.memory !== null && requests.memory !== '';
    const hasMemLim = limits.memory !== undefined && limits.memory !== null && limits.memory !== '';
    const memReq = parseMemoryQuantity(requests.memory);
    const memLim = parseMemoryQuantity(limits.memory);

    totalCpuRequest += cpuReq;
    totalCpuLimit += cpuLim;
    if (!hasCpuLim) allHaveCpuLimit = false;
    if (hasCpuReq) anyHaveCpuRequest = true;

    totalMemRequest += memReq;
    totalMemLimit += memLim;
    if (!hasMemLim) allHaveMemLimit = false;
    if (hasMemReq) anyHaveMemRequest = true;

    // Check Guaranteed conditions:
    // Every container must specify CPU and memory limits, and requests must equal limits.
    if (!hasCpuLim || !hasMemLim || cpuReq !== cpuLim || Math.abs(memReq - memLim) > 0.01) {
      allGuaranteed = false;
    }

    parsedContainers.push({
      name: c.name || 'container',
      cpuRequest: cpuReq,
      cpuRequestFormatted: hasCpuReq ? formatCpuQuantity(cpuReq) : 'None',
      cpuLimit: cpuLim,
      cpuLimitFormatted: hasCpuLim ? formatCpuQuantity(cpuLim) : 'Uncapped',
      hasCpuRequest: hasCpuReq,
      hasCpuLimit: hasCpuLim,

      memRequest: memReq,
      memRequestFormatted: hasMemReq ? formatMemoryQuantity(memReq) : 'None',
      memoryRequestFormatted: hasMemReq ? formatMemoryQuantity(memReq) : 'None',
      memLimit: memLim,
      memLimitFormatted: hasMemLim ? formatMemoryQuantity(memLim) : 'Uncapped',
      memoryLimitFormatted: hasMemLim ? formatMemoryQuantity(memLim) : 'Uncapped',
      hasMemRequest: hasMemReq,
      hasMemLimit: hasMemLim,
      hasMemoryLimit: hasMemLim,
    });
  }

  // Determine QoS Class
  let qosClass: 'Guaranteed' | 'Burstable' | 'BestEffort';
  if (containers.length > 0 && allGuaranteed) {
    qosClass = 'Guaranteed';
  } else if (anyHaveCpuRequest || anyHaveMemRequest || totalCpuLimit > 0 || totalMemLimit > 0) {
    qosClass = 'Burstable';
  } else {
    qosClass = 'BestEffort';
  }

  const hasTotalCpuLimit = allHaveCpuLimit && totalCpuLimit > 0;
  const hasTotalMemLimit = allHaveMemLimit && totalMemLimit > 0;

  const scaledCpuRequest = totalCpuRequest * safeReplicas;
  const scaledCpuLimit = totalCpuLimit * safeReplicas;
  const scaledMemRequest = totalMemRequest * safeReplicas;
  const scaledMemLimit = totalMemLimit * safeReplicas;

  return {
    containers: parsedContainers,

    totalCpuRequest,
    totalCpuRequestFormatted: totalCpuRequest > 0 ? formatCpuQuantity(totalCpuRequest) : 'None',
    totalCpuLimit,
    totalCpuLimitFormatted: hasTotalCpuLimit ? formatCpuQuantity(totalCpuLimit) : 'Uncapped',
    hasTotalCpuLimit,
    hasUncappedCpuLimit: !hasTotalCpuLimit,
    hasTotalCpuRequest: totalCpuRequest > 0,

    totalMemRequest,
    totalMemRequestFormatted: totalMemRequest > 0 ? formatMemoryQuantity(totalMemRequest) : 'None',
    totalMemoryRequestFormatted: totalMemRequest > 0 ? formatMemoryQuantity(totalMemRequest) : 'None',
    totalMemLimit,
    totalMemoryLimit: totalMemLimit,
    totalMemLimitFormatted: hasTotalMemLimit ? formatMemoryQuantity(totalMemLimit) : 'Uncapped',
    totalMemoryLimitFormatted: hasTotalMemLimit ? formatMemoryQuantity(totalMemLimit) : 'Uncapped',
    hasTotalMemLimit,
    hasUncappedMemoryLimit: !hasTotalMemLimit,
    hasTotalMemRequest: totalMemRequest > 0,

    qosClass,

    replicas: safeReplicas,
    scaledCpuRequest,
    scaledCpuRequestFormatted: scaledCpuRequest > 0 ? formatCpuQuantity(scaledCpuRequest) : 'None',
    scaledCpuLimit,
    scaledCpuLimitFormatted: hasTotalCpuLimit ? formatCpuQuantity(scaledCpuLimit) : 'Uncapped',
    scaledMemRequest,
    scaledMemRequestFormatted: scaledMemRequest > 0 ? formatMemoryQuantity(scaledMemRequest) : 'None',
    scaledMemoryRequestFormatted: scaledMemRequest > 0 ? formatMemoryQuantity(scaledMemRequest) : 'None',
    scaledMemLimit,
    scaledMemLimitFormatted: hasTotalMemLimit ? formatMemoryQuantity(scaledMemLimit) : 'Uncapped',
    scaledMemoryLimitFormatted: hasTotalMemLimit ? formatMemoryQuantity(scaledMemLimit) : 'Uncapped',
  };
}
