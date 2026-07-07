import Constants from 'expo-constants';

function getExpoHostIp() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri) {
    return '';
  }

  return hostUri.split(':')[0] ?? '';
}

function normalizeLocalhost(baseUrl: string) {
  const hostIp = getExpoHostIp();
  if (!hostIp) {
    return baseUrl;
  }

  return baseUrl
    .replace('localhost', hostIp)
    .replace('127.0.0.1', hostIp);
}

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function normalizeUrlWhitespace(url: string) {
  return url.replace(/\s+/g, '');
}

export function resolveApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (fromEnv) {
    return stripTrailingSlash(normalizeLocalhost(normalizeUrlWhitespace(fromEnv)));
  }

  const hostIp = getExpoHostIp();
  if (hostIp) {
    return `http://${hostIp}:3000`;
  }

  return 'http://192.168.1.10:3000';
}

export const API_BASE_URL = resolveApiBaseUrl();
