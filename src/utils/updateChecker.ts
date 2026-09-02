import { open } from '@tauri-apps/plugin-shell';

export interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
  recommendedAsset?: ReleaseAsset;
  allAssets: ReleaseAsset[];
  checkedAt: number;
}

export type PlatformType = 'macos' | 'windows' | 'linux' | 'unknown';

export function detectUserPlatform(): { platform: PlatformType; arch: string } {
  if (typeof window === 'undefined') return { platform: 'unknown', arch: 'x64' };
  
  const ua = window.navigator.userAgent.toLowerCase();
  let platform: PlatformType = 'unknown';
  let arch = 'x64';

  if (ua.includes('mac') || ua.includes('darwin')) {
    platform = 'macos';
    // Most modern Apple Silicon Macs
    arch = 'arm64';
  } else if (ua.includes('win')) {
    platform = 'windows';
    arch = 'x64';
  } else if (ua.includes('linux')) {
    platform = 'linux';
    arch = 'x64';
  }

  return { platform, arch };
}

export function pickRecommendedAsset(assets: ReleaseAsset[], platform: PlatformType, arch: string): ReleaseAsset | undefined {
  if (!assets || assets.length === 0) return undefined;

  if (platform === 'macos') {
    // Prefer matching architecture DMG
    const armDmg = assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')));
    if (arch === 'arm64' && armDmg) return armDmg;
    const anyDmg = assets.find(a => a.name.endsWith('.dmg'));
    if (anyDmg) return anyDmg;
  }

  if (platform === 'windows') {
    // Prefer setup .exe then .msi
    const exe = assets.find(a => a.name.endsWith('.exe') && a.name.includes('setup'));
    if (exe) return exe;
    const msi = assets.find(a => a.name.endsWith('.msi'));
    if (msi) return msi;
  }

  if (platform === 'linux') {
    // Prefer AppImage or deb
    const appimage = assets.find(a => a.name.endsWith('.AppImage'));
    if (appimage) return appimage;
    const deb = assets.find(a => a.name.endsWith('.deb'));
    if (deb) return deb;
  }

  return assets[0];
}

/**
 * Robust semver comparison.
 * Returns true if latest > current.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const cleanCurrent = current.replace(/^v/, '').trim();
  const cleanLatest = latest.replace(/^v/, '').trim();

  const cParts = cleanCurrent.split('.').map(p => parseInt(p, 10) || 0);
  const lParts = cleanLatest.split('.').map(p => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(cParts.length, lParts.length, 3); i++) {
    const c = cParts[i] ?? 0;
    const l = lParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

const CACHE_KEY = 'k8sui:update_info';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export const CURRENT_APP_VERSION = '0.1.1';

export async function checkForAppUpdates(force = false): Promise<UpdateInfo | null> {
  // Check local cache first if not forced
  if (!force && typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: UpdateInfo = JSON.parse(cached);
        if (Date.now() - parsed.checkedAt < CACHE_TTL_MS && parsed.currentVersion === CURRENT_APP_VERSION) {
          return parsed;
        }
      }
    } catch {
      // Ignore cache read errors
    }
  }

  try {
    const response = await fetch('https://api.github.com/repos/akretrix/k8sUI/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      // If 404 (e.g. no published releases yet or offline), handle gracefully
      return null;
    }

    const data = await response.json();
    const latestTag = (data.tag_name || '').replace(/^v/, '');
    const hasUpdate = isNewerVersion(CURRENT_APP_VERSION, latestTag);

    const { platform, arch } = detectUserPlatform();
    const assets: ReleaseAsset[] = (data.assets || []).map((a: any) => ({
      name: a.name,
      size: a.size,
      browser_download_url: a.browser_download_url,
    }));

    const recommendedAsset = pickRecommendedAsset(assets, platform, arch);

    const result: UpdateInfo = {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latestTag || CURRENT_APP_VERSION,
      releaseName: data.name || `k8sUI v${latestTag}`,
      releaseUrl: data.html_url || 'https://github.com/akretrix/k8sUI/releases',
      releaseNotes: data.body || 'Bug fixes and performance enhancements.',
      publishedAt: data.published_at || new Date().toISOString(),
      recommendedAsset,
      allAssets: assets,
      checkedAt: Date.now(),
    };

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      } catch {
        // Ignore cache storage errors
      }
    }

    return result;
  } catch (err) {
    console.warn('[UpdateChecker] Could not check GitHub releases:', err);
    return null;
  }
}

export async function openDownloadLink(url: string) {
  try {
    await open(url);
  } catch {
    window.open(url, '_blank');
  }
}
