import { describe, it, expect } from 'vitest';
import {
  parseCpuQuantity,
  formatCpuQuantity,
  parseMemoryQuantity,
  formatMemoryQuantity,
  calculateWorkloadResources,
} from './k8sResources';

describe('k8sResources Parser & Engine', () => {
  describe('CPU parsing and formatting', () => {
    it('parses millicores correctly', () => {
      expect(parseCpuQuantity('100m')).toBe(100);
      expect(parseCpuQuantity('250m')).toBe(250);
      expect(parseCpuQuantity('0m')).toBe(0);
    });

    it('parses whole and fractional cores', () => {
      expect(parseCpuQuantity('1')).toBe(1000);
      expect(parseCpuQuantity('2.5')).toBe(2500);
      expect(parseCpuQuantity('0.5')).toBe(500);
      expect(parseCpuQuantity(2)).toBe(2000);
    });

    it('parses microcores and nanocores', () => {
      expect(parseCpuQuantity('500000u')).toBe(500);
      expect(parseCpuQuantity('1000000000n')).toBe(1000);
    });

    it('handles undefined, null, and invalid values gracefully', () => {
      expect(parseCpuQuantity(undefined)).toBe(0);
      expect(parseCpuQuantity(null)).toBe(0);
      expect(parseCpuQuantity('')).toBe(0);
      expect(parseCpuQuantity('invalid')).toBe(0);
    });

    it('formats millicores into clean human strings', () => {
      expect(formatCpuQuantity(100)).toBe('100m');
      expect(formatCpuQuantity(500)).toBe('500m');
      expect(formatCpuQuantity(1000)).toBe('1.0 cores');
      expect(formatCpuQuantity(2500)).toBe('2.5 cores');
      expect(formatCpuQuantity(0)).toBe('None');
    });
  });

  describe('Memory parsing and formatting', () => {
    it('parses binary SI units (Ki, Mi, Gi, Ti)', () => {
      expect(parseMemoryQuantity('1024Ki')).toBe(1);
      expect(parseMemoryQuantity('128Mi')).toBe(128);
      expect(parseMemoryQuantity('1Gi')).toBe(1024);
      expect(parseMemoryQuantity('2.5Gi')).toBe(2560);
    });

    it('parses raw bytes', () => {
      expect(parseMemoryQuantity('1048576')).toBe(1);
      expect(parseMemoryQuantity(1048576)).toBe(1);
    });

    it('formats memory into clean human strings', () => {
      expect(formatMemoryQuantity(128)).toBe('128 MiB');
      expect(formatMemoryQuantity(1024)).toBe('1.0 GiB');
      expect(formatMemoryQuantity(2560)).toBe('2.5 GiB');
      expect(formatMemoryQuantity(0)).toBe('None');
    });
  });

  describe('calculateWorkloadResources', () => {
    it('calculates Guaranteed QoS when requests equal limits for all containers', () => {
      const containers = [
        {
          name: 'app',
          resources: {
            requests: { cpu: '500m', memory: '512Mi' },
            limits: { cpu: '500m', memory: '512Mi' },
          },
        },
      ];

      const res = calculateWorkloadResources(containers, 1);
      expect(res.qosClass).toBe('Guaranteed');
      expect(res.totalCpuRequestFormatted).toBe('500m');
      expect(res.totalCpuLimitFormatted).toBe('500m');
      expect(res.totalMemRequestFormatted).toBe('512 MiB');
      expect(res.totalMemLimitFormatted).toBe('512 MiB');
      expect(res.hasTotalCpuLimit).toBe(true);
      expect(res.hasTotalMemLimit).toBe(true);
    });

    it('calculates Burstable QoS when limits exceed requests', () => {
      const containers = [
        {
          name: 'api',
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '1024Mi' },
          },
        },
      ];

      const res = calculateWorkloadResources(containers, 3);
      expect(res.qosClass).toBe('Burstable');
      expect(res.totalCpuRequestFormatted).toBe('100m');
      expect(res.totalCpuLimitFormatted).toBe('500m');
      // Scaled footprint for 3 replicas
      expect(res.scaledCpuRequestFormatted).toBe('300m');
      expect(res.scaledCpuLimitFormatted).toBe('1.5 cores');
      expect(res.scaledMemRequestFormatted).toBe('384 MiB');
      expect(res.scaledMemLimitFormatted).toBe('3.0 GiB');
    });

    it('calculates BestEffort QoS when no requests or limits are set', () => {
      const containers = [
        {
          name: 'unconstrained',
          resources: {},
        },
      ];

      const res = calculateWorkloadResources(containers, 2);
      expect(res.qosClass).toBe('BestEffort');
      expect(res.totalCpuLimitFormatted).toBe('Uncapped');
      expect(res.totalMemLimitFormatted).toBe('Uncapped');
      expect(res.hasTotalCpuLimit).toBe(false);
      expect(res.hasTotalMemLimit).toBe(false);
    });

    it('aggregates multi-container workloads accurately', () => {
      const containers = [
        {
          name: 'main-app',
          resources: {
            requests: { cpu: '200m', memory: '256Mi' },
            limits: { cpu: '400m', memory: '512Mi' },
          },
        },
        {
          name: 'sidecar-proxy',
          resources: {
            requests: { cpu: '50m', memory: '64Mi' },
            limits: { cpu: '100m', memory: '128Mi' },
          },
        },
      ];

      const res = calculateWorkloadResources(containers, 2);
      expect(res.containers).toHaveLength(2);
      expect(res.totalCpuRequest).toBe(250);
      expect(res.totalCpuRequestFormatted).toBe('250m');
      expect(res.totalCpuLimit).toBe(500);
      expect(res.totalCpuLimitFormatted).toBe('500m');
      expect(res.totalMemRequest).toBe(320);
      expect(res.totalMemRequestFormatted).toBe('320 MiB');
      expect(res.totalMemLimit).toBe(640);
      expect(res.totalMemLimitFormatted).toBe('640 MiB');
      // Scaled across 2 replicas
      expect(res.scaledCpuRequestFormatted).toBe('500m');
      expect(res.scaledCpuLimitFormatted).toBe('1.0 cores');
      expect(res.scaledMemRequestFormatted).toBe('640 MiB');
      expect(res.scaledMemLimitFormatted).toBe('1.3 GiB');
    });
  });
});
