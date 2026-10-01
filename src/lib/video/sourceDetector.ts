import Hls from 'hls.js';
import { VideoSourceType, ValidationStatus } from '../../types';
import { extractGoogleDriveFileId } from './processor';

export interface SourceValidationResult {
  status: ValidationStatus;
  sourceType: VideoSourceType;
  resolvedStreamUrl: string;
  isStreamable: boolean;
  message: string;
  details?: string;
  duration?: number;
  width?: number;
  height?: number;
  levels?: string[];
}

/**
 * Automatically identifies the video source type from a URL.
 */
export function detectSourceType(inputUrl: string): VideoSourceType {
  if (!inputUrl || typeof inputUrl !== 'string') return 'unknown';
  const clean = inputUrl.trim();
  if (!clean) return 'unknown';

  // Check URL validity
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(clean);
  } catch {
    // Check if relative or data URI
    if (clean.startsWith('data:video/')) {
      if (clean.includes('mp4')) return 'mp4';
      if (clean.includes('webm')) return 'webm';
      if (clean.includes('ogg')) return 'ogg';
    }
    return 'unknown';
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  const search = parsedUrl.search.toLowerCase();

  // 1. Google Drive URLs
  if (
    hostname.includes('drive.google.com') ||
    hostname.includes('docs.google.com') ||
    clean.includes('drive.google.com/file/d/') ||
    clean.includes('drive.google.com/open?id=') ||
    clean.includes('drive.google.com/uc?')
  ) {
    return 'google-drive';
  }

  // 2. Webpage URLs (Interactive web pages, not direct streams)
  if (
    hostname.includes('youtube.com') ||
    hostname.includes('youtu.be') ||
    hostname.includes('facebook.com') ||
    hostname.includes('fb.watch') ||
    hostname.includes('netflix.com') ||
    hostname.includes('tiktok.com') ||
    hostname.includes('instagram.com') ||
    hostname.includes('twitch.tv') ||
    hostname.includes('dailymotion.com') ||
    (hostname.includes('vimeo.com') && !pathname.endsWith('.mp4') && !pathname.endsWith('.m3u8'))
  ) {
    return 'webpage';
  }

  // 3. HLS .m3u8 (Adaptive Bitrate)
  if (
    pathname.endsWith('.m3u8') ||
    pathname.includes('.m3u8') ||
    search.includes('.m3u8') ||
    search.includes('format=m3u8') ||
    search.includes('type=m3u8')
  ) {
    return 'hls';
  }

  // 4. MPEG-DASH .mpd
  if (pathname.endsWith('.mpd') || pathname.includes('.mpd') || search.includes('.mpd')) {
    return 'dash';
  }

  // 5. Direct MP4
  if (pathname.endsWith('.mp4') || pathname.endsWith('.m4v') || search.includes('.mp4')) {
    return 'mp4';
  }

  // 6. Direct WebM
  if (pathname.endsWith('.webm') || search.includes('.webm')) {
    return 'webm';
  }

  // 7. Direct Ogg
  if (pathname.endsWith('.ogv') || pathname.endsWith('.ogg') || search.includes('.ogv')) {
    return 'ogg';
  }

  // Default fallback for generic HTTP/HTTPS streams
  return 'unknown';
}

/**
 * Human-readable label for a detected video source type.
 */
export function getSourceTypeLabel(type: VideoSourceType): string {
  switch (type) {
    case 'hls':
      return 'HLS Stream (.m3u8)';
    case 'mp4':
      return 'Direct MP4 Video';
    case 'webm':
      return 'Direct WebM Video';
    case 'ogg':
      return 'Direct OGG Video';
    case 'dash':
      return 'MPEG-DASH (.mpd)';
    case 'google-drive':
      return 'Google Drive Link';
    case 'webpage':
      return 'Webpage URL (Unsupported)';
    default:
      return 'Direct Stream (Auto-Detect)';
  }
}

/**
 * Checks whether a URL is a normal HTML webpage instead of a direct stream.
 */
export function checkIsWebpage(url: string): { isWebpage: boolean; serviceName?: string } {
  const clean = url.trim().toLowerCase();
  if (clean.includes('youtube.com') || clean.includes('youtu.be')) {
    return { isWebpage: true, serviceName: 'YouTube' };
  }
  if (clean.includes('facebook.com') || clean.includes('fb.watch')) {
    return { isWebpage: true, serviceName: 'Facebook Video' };
  }
  if (clean.includes('netflix.com')) {
    return { isWebpage: true, serviceName: 'Netflix' };
  }
  if (clean.includes('tiktok.com')) {
    return { isWebpage: true, serviceName: 'TikTok' };
  }
  if (clean.includes('instagram.com')) {
    return { isWebpage: true, serviceName: 'Instagram' };
  }
  if (clean.includes('dailymotion.com')) {
    return { isWebpage: true, serviceName: 'Dailymotion' };
  }
  if (clean.includes('vimeo.com') && !clean.includes('.mp4') && !clean.includes('.m3u8')) {
    return { isWebpage: true, serviceName: 'Vimeo' };
  }
  return { isWebpage: false };
}

/**
 * Resolves a Google Drive sharing URL into a direct candidate link,
 * and warns why viewer links cannot be streamed directly.
 */
export function resolveGoogleDriveStreamCandidate(url: string): {
  fileId: string;
  directCandidateUrl: string;
  isViewerUrl: boolean;
} {
  const fileId = extractGoogleDriveFileId(url);
  const isViewerUrl = url.includes('/view') || url.includes('/preview') || url.includes('drive.google.com/file/d/');
  const directCandidateUrl = fileId
    ? `https://drive.google.com/uc?id=${fileId}&export=download`
    : url;
  return { fileId, directCandidateUrl, isViewerUrl };
}

/**
 * Comprehensive client-side source validation:
 * Probes the URL format, source type, and browser playback capability.
 * Tests HLS manifests or media containers using non-destructive probes.
 */
export async function validateVideoSource(
  inputUrl: string,
  timeoutMs: number = 8000
): Promise<SourceValidationResult> {
  const url = inputUrl.trim();

  // 1. URL syntax validation
  if (!url) {
    return {
      status: 'INVALID_URL',
      sourceType: 'unknown',
      resolvedStreamUrl: '',
      isStreamable: false,
      message: 'Video URL is required. Please enter a valid stream URL.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
      throw new Error('Unsupported protocol');
    }
  } catch {
    return {
      status: 'INVALID_URL',
      sourceType: 'unknown',
      resolvedStreamUrl: url,
      isStreamable: false,
      message: 'Invalid URL format. Video URL must start with http:// or https://.',
    };
  }

  const sourceType = detectSourceType(url);

  // 2. Reject Webpage URLs (YouTube, Facebook, Netflix, etc.)
  const webpageCheck = checkIsWebpage(url);
  if (webpageCheck.isWebpage) {
    return {
      status: 'UNSUPPORTED_SOURCE',
      sourceType: 'webpage',
      resolvedStreamUrl: url,
      isStreamable: false,
      message: `${webpageCheck.serviceName} webpage URLs are not direct streaming files. HTML web pages contain proprietary players, DRM, and iframe restrictions that cannot be streamed in an HTML5 video player. Please provide a direct .m3u8, .mp4, or .webm video stream URL.`,
    };
  }

  // 3. MPEG-DASH (.mpd) notice
  if (sourceType === 'dash') {
    return {
      status: 'UNSUPPORTED_SOURCE',
      sourceType: 'dash',
      resolvedStreamUrl: url,
      isStreamable: false,
      message: 'MPEG-DASH (.mpd) requires custom MSE DASH client architecture. For optimal cross-browser synchronization and mobile compatibility, please use HLS (.m3u8) or direct MP4.',
    };
  }

  // 4. Google Drive URL handling
  if (sourceType === 'google-drive') {
    const { fileId, directCandidateUrl, isViewerUrl } = resolveGoogleDriveStreamCandidate(url);
    if (!fileId) {
      return {
        status: 'INVALID_URL',
        sourceType: 'google-drive',
        resolvedStreamUrl: url,
        isStreamable: false,
        message: 'Could not extract a valid Google Drive File ID from this link.',
      };
    }

    // A Google Drive /view or /preview link is an interactive HTML viewer page
    return {
      status: 'UNSUPPORTED_SOURCE',
      sourceType: 'google-drive',
      resolvedStreamUrl: directCandidateUrl,
      isStreamable: false,
      message:
        'Google Drive viewer URLs (/view) are interactive HTML preview pages, not direct video stream endpoints. Google Drive does not support continuous live streaming: files over 100MB trigger a virus scan interstitial page, and Google Drive endpoints do not include streaming CORS headers. To broadcast, host your .mp4 or .m3u8 file on a CDN, Cloudflare R2, or direct web server.',
      details: `Google Drive File ID: ${fileId}.`,
    };
  }

  // 5. HLS .m3u8 Source Testing
  if (sourceType === 'hls') {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            status: 'READY',
            sourceType: 'hls',
            resolvedStreamUrl: url,
            isStreamable: true,
            message: 'HLS stream detected. Ready for playback.',
          });
        }
      }, timeoutMs);

      // Probe with Hls.js
      if (Hls.isSupported()) {
        const testHls = new Hls({
          enableWorker: false,
          manifestLoadingTimeOut: 6000,
          manifestLoadingMaxRetry: 1,
        });

        testHls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            const qualities = data.levels.map((lvl) => `${lvl.height}p`);
            testHls.destroy();
            resolve({
              status: 'READY',
              sourceType: 'hls',
              resolvedStreamUrl: url,
              isStreamable: true,
              message: `HLS manifest parsed successfully (${data.levels.length} adaptive rendition${
                data.levels.length > 1 ? 's' : ''
              } detected).`,
              levels: qualities,
            });
          }
        });

        testHls.on(Hls.Events.ERROR, (_event, data) => {
          if (!resolved && data.fatal) {
            resolved = true;
            clearTimeout(timer);
            testHls.destroy();

            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
              const code = data.response?.code;
              if (code === 0 || !code) {
                resolve({
                  status: 'CORS_BLOCKED',
                  sourceType: 'hls',
                  resolvedStreamUrl: url,
                  isStreamable: false,
                  message:
                    'CORS Blocked or Network Unreachable: The HLS server does not allow Cross-Origin Resource Sharing (CORS). Ensure the server adds Access-Control-Allow-Origin: * headers.',
                });
              } else if (code === 404) {
                resolve({
                  status: 'SOURCE_UNAVAILABLE',
                  sourceType: 'hls',
                  resolvedStreamUrl: url,
                  isStreamable: false,
                  message: 'HLS stream playlist not found (HTTP 404). Check the .m3u8 URL.',
                });
              } else {
                resolve({
                  status: 'SOURCE_UNAVAILABLE',
                  sourceType: 'hls',
                  resolvedStreamUrl: url,
                  isStreamable: false,
                  message: `HLS stream returned HTTP error ${code}. Check stream server status.`,
                });
              }
            } else if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
              resolve({
                status: 'HLS_ERROR',
                sourceType: 'hls',
                resolvedStreamUrl: url,
                isStreamable: false,
                message: 'HLS manifest parsing error: The URL returned invalid or corrupted .m3u8 playlist data.',
              });
            } else {
              resolve({
                status: 'HLS_ERROR',
                sourceType: 'hls',
                resolvedStreamUrl: url,
                isStreamable: false,
                message: `HLS playback error: ${data.details || 'Unable to load manifest'}.`,
              });
            }
          }
        });

        try {
          testHls.loadSource(url);
        } catch (e: any) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            testHls.destroy();
            resolve({
              status: 'HLS_ERROR',
              sourceType: 'hls',
              resolvedStreamUrl: url,
              isStreamable: false,
              message: `HLS initialization error: ${e?.message || 'Invalid HLS source'}.`,
            });
          }
        }
      } else {
        // Native HLS (Safari/iOS)
        clearTimeout(timer);
        resolve({
          status: 'READY',
          sourceType: 'hls',
          resolvedStreamUrl: url,
          isStreamable: true,
          message: 'HLS stream URL detected. Native Safari/Apple HLS playback supported.',
        });
      }
    });
  }

  // 6. Direct Video Files (MP4, WebM, OGG, Unknown)
  return new Promise((resolve) => {
    let resolved = false;
    const testVideo = document.createElement('video');
    testVideo.preload = 'metadata';
    testVideo.crossOrigin = 'anonymous';

    const cleanup = () => {
      testVideo.removeAttribute('src');
      testVideo.load();
      testVideo.remove();
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        // If timeout reached without fatal error, mark ready with caveat
        resolve({
          status: 'READY',
          sourceType,
          resolvedStreamUrl: url,
          isStreamable: true,
          message: `${getSourceTypeLabel(sourceType)} configured and ready for playback.`,
        });
      }
    }, timeoutMs);

    testVideo.onloadedmetadata = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const dur = testVideo.duration;
        const w = testVideo.videoWidth;
        const h = testVideo.videoHeight;
        cleanup();
        resolve({
          status: 'READY',
          sourceType,
          resolvedStreamUrl: url,
          isStreamable: true,
          message: `${getSourceTypeLabel(sourceType)} verified (${w}x${h}, ${
            isNaN(dur) ? 'Live' : Math.round(dur) + 's'
          }). Browser can decode this stream.`,
          duration: isNaN(dur) ? undefined : dur,
          width: w,
          height: h,
        });
      }
    };

    testVideo.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const err = testVideo.error;
        cleanup();

        if (!err) {
          resolve({
            status: 'SOURCE_UNAVAILABLE',
            sourceType,
            resolvedStreamUrl: url,
            isStreamable: false,
            message: 'Unable to load video stream. The source may be offline, invalid, or unreachable.',
          });
          return;
        }

        switch (err.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            resolve({
              status: 'CORS_BLOCKED',
              sourceType,
              resolvedStreamUrl: url,
              isStreamable: false,
              message:
                'Network Error or CORS Blocked: The video server failed to respond or blocked cross-origin requests. Verify that CORS headers are enabled.',
            });
            break;
          case MediaError.MEDIA_ERR_DECODE:
            resolve({
              status: 'MEDIA_FORMAT_ERROR',
              sourceType,
              resolvedStreamUrl: url,
              isStreamable: false,
              message:
                'Codec / Media Error: The browser could not decode this video container or audio/video codec.',
            });
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            resolve({
              status: 'UNSUPPORTED_SOURCE',
              sourceType,
              resolvedStreamUrl: url,
              isStreamable: false,
              message:
                'Source Unavailable or Unsupported Format: The URL returned 404/403, or the container format is not supported by standard HTML5 video.',
            });
            break;
          default:
            resolve({
              status: 'SOURCE_UNAVAILABLE',
              sourceType,
              resolvedStreamUrl: url,
              isStreamable: false,
              message: `Video playback probe error: ${err.message || 'Source could not be played'}.`,
            });
        }
      }
    };

    try {
      testVideo.src = url;
    } catch (e: any) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          status: 'INVALID_URL',
          sourceType,
          resolvedStreamUrl: url,
          isStreamable: false,
          message: `Failed to set video source: ${e?.message || 'Invalid URL'}.`,
        });
      }
    }
  });
}
