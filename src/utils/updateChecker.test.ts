import { describe, it, expect } from 'vitest';
import { isNewerVersion, pickRecommendedAsset, ReleaseAsset } from './updateChecker';

describe('updateChecker', () => {
  describe('isNewerVersion', () => {
    it('detects newer patch versions', () => {
      expect(isNewerVersion('0.1.1', '0.1.2')).toBe(true);
      expect(isNewerVersion('v0.1.1', 'v0.1.2')).toBe(true);
    });

    it('detects newer minor and major versions', () => {
      expect(isNewerVersion('0.1.1', '0.2.0')).toBe(true);
      expect(isNewerVersion('0.1.1', '1.0.0')).toBe(true);
    });

    it('returns false for same or older versions', () => {
      expect(isNewerVersion('0.1.1', '0.1.1')).toBe(false);
      expect(isNewerVersion('0.1.2', '0.1.1')).toBe(false);
      expect(isNewerVersion('1.0.0', '0.9.9')).toBe(false);
    });
  });

  describe('pickRecommendedAsset', () => {
    const mockAssets: ReleaseAsset[] = [
      { name: 'k8s-ui_0.1.2_aarch64.dmg', size: 5000000, browser_download_url: 'https://example.com/mac-arm.dmg' },
      { name: 'k8s-ui_0.1.2_x64.dmg', size: 5000000, browser_download_url: 'https://example.com/mac-x64.dmg' },
      { name: 'k8s-ui_0.1.2_x64-setup.exe', size: 8000000, browser_download_url: 'https://example.com/win.exe' },
      { name: 'k8s-ui_0.1.2_amd64.AppImage', size: 80000000, browser_download_url: 'https://example.com/linux.AppImage' },
      { name: 'k8s-ui_0.1.2_amd64.deb', size: 8000000, browser_download_url: 'https://example.com/linux.deb' },
    ];

    it('picks ARM64 DMG for macOS ARM64', () => {
      const asset = pickRecommendedAsset(mockAssets, 'macos', 'arm64');
      expect(asset?.name).toBe('k8s-ui_0.1.2_aarch64.dmg');
    });

    it('picks setup exe for Windows', () => {
      const asset = pickRecommendedAsset(mockAssets, 'windows', 'x64');
      expect(asset?.name).toBe('k8s-ui_0.1.2_x64-setup.exe');
    });

    it('picks AppImage for Linux', () => {
      const asset = pickRecommendedAsset(mockAssets, 'linux', 'x64');
      expect(asset?.name).toBe('k8s-ui_0.1.2_amd64.AppImage');
    });
  });
});
