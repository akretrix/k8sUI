import { describe, it, expect } from 'vitest';
import { cleanClusterName, getClusterMonogram, getEnvironmentVisuals } from './clusterNames';

describe('clusterNames utilities', () => {
  describe('cleanClusterName', () => {
    it('cleans AWS EKS full ARNs down to cluster leaf name', () => {
      const arn = 'arn:aws:eks:eu-central-1:123456789012:cluster/prod-workloads-cluster';
      expect(cleanClusterName(arn)).toBe('prod-workloads-cluster');
    });

    it('strips provider prefixes', () => {
      expect(cleanClusterName('eks:prod-payments-api')).toBe('prod-payments-api');
      expect(cleanClusterName('local:docker-desktop')).toBe('docker-desktop');
    });

    it('handles simple names cleanly', () => {
      expect(cleanClusterName('demo-cluster')).toBe('demo-cluster');
      expect(cleanClusterName('minikube')).toBe('minikube');
    });
  });

  describe('getClusterMonogram', () => {
    it('generates 4-letter uppercase monograms from hyphenated names', () => {
      expect(getClusterMonogram('demo-cluster')).toBe('DECL');
      expect(getClusterMonogram('docker-desktop')).toBe('DODE');
      expect(getClusterMonogram('minikube')).toBe('MINI');
    });

    it('generates distinctive 4-letter codes for env-prefixed clusters', () => {
      expect(getClusterMonogram('prod-workloads-cluster')).toBe('PWRK');
      expect(getClusterMonogram('dev-api-cluster')).toBe('DAPI');
    });

    it('handles ARNs seamlessly by cleaning them first', () => {
      const arn = 'arn:aws:eks:eu-central-1:123456789012:cluster/prod-workloads-cluster';
      expect(getClusterMonogram(arn)).toBe('PWRK');
    });
  });

  describe('getEnvironmentVisuals', () => {
    it('identifies production correctly', () => {
      const prod = getEnvironmentVisuals('Production');
      expect(prod.label).toBe('PROD');
      expect(prod.textColor).toContain('red');
    });

    it('identifies staging / QA correctly', () => {
      const stg = getEnvironmentVisuals('Staging');
      expect(stg.label).toBe('STG');
      expect(stg.textColor).toContain('amber');
    });

    it('identifies development correctly', () => {
      const dev = getEnvironmentVisuals('Development');
      expect(dev.label).toBe('DEV');
      expect(dev.textColor).toContain('emerald');
    });
  });
});
