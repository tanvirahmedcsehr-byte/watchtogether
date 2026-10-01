import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import Hls from 'hls.js';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  WifiOff,
  AlertCircle,
  Subtitles,
  Settings,
  Tv,
  Check,
  Radio,
  RefreshCw,
  Film,
  Info,
} from 'lucide-react';
import { Subtitle, VideoSourceType } from '../../types';
import {
  detectSourceType,
  getSourceTypeLabel,
  checkIsWebpage,
  resolveGoogleDriveStreamCandidate,
} from '../../lib/video/sourceDetector';

export interface VideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  isAdmin?: boolean;
  isSyncing?: boolean;
  syncStatus?: 'synced' | 'syncing' | 'reconnecting';
  autoplayBlocked?: boolean;
  subtitles?: Subtitle[];
  availableQualities?: string[]; // e.g. ['1080p', '720p', '480p', '360p']
  onAutoplayUnlock?: () => void;
  onAdminPlay?: () => void;
  onAdminPause?: () => void;
  onAdminSeek?: (seconds: number) => void;
  onAdminRestart?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      src,
      poster,
      title,
      isAdmin = false,
      isSyncing = false,
      syncStatus = 'synced',
      autoplayBlocked = false,
      subtitles = [],
      availableQualities = ['1080p', '720p', '480p', '360p'],
      onAutoplayUnlock,
      onAdminPlay,
      onAdminPause,
      onAdminSeek,
      onAdminRestart,
      onTimeUpdate,
      onEnded,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(1);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isBuffering, setIsBuffering] = useState<boolean>(true);
    const [videoError, setVideoError] = useState<{
      title: string;
      message: string;
      category: 'cors' | 'network' | 'codec' | 'format' | 'hls' | 'webpage' | 'generic';
    } | null>(null);
    const [showControls, setShowControls] = useState<boolean>(true);
    const controlsTimeoutRef = useRef<number | null>(null);

    // Source detection & dynamic qualities
    const [detectedType, setDetectedType] = useState<VideoSourceType>('unknown');
    const [detectedQualities, setDetectedQualities] = useState<string[]>(availableQualities);
    const [selectedQuality, setSelectedQuality] = useState<string>('Auto');
    const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('off');
    const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
    const [activeMenuTab, setActiveMenuTab] = useState<'main' | 'quality' | 'subtitles'>('main');

    useImperativeHandle(ref, () => ({
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
          } catch (err) {
            console.warn('Play error or autoplay blocked:', err);
            throw err;
          }
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seek: (seconds: number) => {
        if (videoRef.current) {
          const clamped = Math.max(0, Math.min(seconds, videoRef.current.duration || 999999));
          videoRef.current.currentTime = clamped;
        }
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      getDuration: () => videoRef.current?.duration || 0,
      isPaused: () => videoRef.current?.paused ?? true,
    }));

    // Universal Video Setup: Detects source type and initializes appropriate playback pipeline
    const initializePlayer = () => {
      const video = videoRef.current;
      if (!video) return;

      setVideoError(null);
      setIsBuffering(true);

      // Clean up existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const cleanSrc = (src || '').trim();
      if (!cleanSrc) {
        setIsBuffering(false);
        setVideoError({
          title: 'No Video Stream URL',
          message: 'The selected movie has no streaming URL configured. Please edit the movie in Admin to add a valid stream.',
          category: 'generic',
        });
        return;
      }

      // Check for webpage URLs (YouTube, Facebook, Netflix, etc.)
      const webpageCheck = checkIsWebpage(cleanSrc);
      if (webpageCheck.isWebpage) {
        setIsBuffering(false);
        setDetectedType('webpage');
        setVideoError({
          title: `Unsupported Source: ${webpageCheck.serviceName} Webpage`,
          message:
            'Webpage watch URLs cannot be played in an HTML5 video stream. Webpage links contain HTML wrappers, DRM, and iframe restrictions. Please supply a direct streaming link (.m3u8, .mp4, or .webm).',
          category: 'webpage',
        });
        return;
      }

      const type = detectSourceType(cleanSrc);
      setDetectedType(type);

      // Handle Google Drive Links
      if (type === 'google-drive') {
        const { fileId, directCandidateUrl, isViewerUrl } = resolveGoogleDriveStreamCandidate(cleanSrc);
        if (isViewerUrl) {
          setIsBuffering(false);
          setVideoError({
            title: 'Google Drive Viewer Link Not Streamable',
            message:
              'Google Drive viewer links (/view) are interactive HTML pages, not direct video streams. Google Drive blocks continuous live streaming and requires direct CDN or media hosting. Please provide a direct .mp4 or .m3u8 link.',
            category: 'format',
          });
          return;
        }
      }

      // HLS .m3u8 Playback Pipeline
      if (type === 'hls') {
        // Native HLS for Safari & iOS
        const canPlayNativeHls =
          video.canPlayType('application/vnd.apple.mpegurl') ||
          video.canPlayType('application/x-mpegURL');

        if (canPlayNativeHls && !Hls.isSupported()) {
          video.src = cleanSrc;
          video.load();
        } else if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 60,
          });
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
            setIsBuffering(false);
            if (data.levels && data.levels.length > 0) {
              const parsedLevels = data.levels.map((l) => `${l.height}p`);
              setDetectedQualities(parsedLevels);
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            console.warn('HLS Event Error:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                    const status = data.response?.code;
                    if (status === 0 || !status) {
                      setVideoError({
                        title: 'CORS Blocked or Server Unreachable',
                        message:
                          'The HLS streaming server did not return CORS headers (Access-Control-Allow-Origin). The browser blocked the video stream request.',
                        category: 'cors',
                      });
                    } else if (status === 404) {
                      setVideoError({
                        title: 'HLS Stream Not Found (404)',
                        message: 'The .m3u8 playlist file could not be found on the server. Verify the streaming URL.',
                        category: 'network',
                      });
                    } else {
                      setVideoError({
                        title: 'HLS Network Failure',
                        message: `The streaming server returned HTTP status ${status}. Retrying connection…`,
                        category: 'network',
                      });
                      hls.startLoad();
                    }
                  } else {
                    hls.startLoad();
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  setVideoError({
                    title: 'HLS Manifest / Stream Failure',
                    message: `Fatal streaming failure (${data.details || 'Unknown'}). Check that the .m3u8 manifest is active and reachable.`,
                    category: 'hls',
                  });
                  hls.destroy();
                  break;
              }
            }
          });

          try {
            hls.loadSource(cleanSrc);
            hls.attachMedia(video);
          } catch (e: any) {
            setVideoError({
              title: 'HLS Load Error',
              message: e?.message || 'Failed to initialize HLS stream.',
              category: 'hls',
            });
          }
        } else {
          // Fallback to direct src
          video.src = cleanSrc;
          video.load();
        }
      } else {
        // Direct MP4 / WebM / OGG / Universal HTML5 Video
        video.src = cleanSrc;
        video.load();
      }
    };

    useEffect(() => {
      initializePlayer();
      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src]);

    // Handle Subtitle switching on `<video>` element
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const textTracks = video.textTracks;
      for (let i = 0; i < textTracks.length; i++) {
        const track = textTracks[i];
        if (selectedSubtitleId === 'off') {
          track.mode = 'disabled';
        } else {
          const matchingSub = subtitles.find((s) => s.id === selectedSubtitleId);
          if (matchingSub && (track.label === matchingSub.label || track.language === matchingSub.languageCode)) {
            track.mode = 'showing';
          } else {
            track.mode = 'disabled';
          }
        }
      }
    }, [selectedSubtitleId, subtitles]);

    // Quality level switching via HLS if active
    const handleSelectQuality = (quality: string) => {
      setSelectedQuality(quality);
      if (hlsRef.current) {
        if (quality === 'Auto') {
          hlsRef.current.currentLevel = -1; // Auto adaptive
        } else {
          const height = parseInt(quality.replace('p', ''), 10);
          const levelIdx = hlsRef.current.levels.findIndex((lvl) => lvl.height === height);
          if (levelIdx !== -1) {
            hlsRef.current.currentLevel = levelIdx;
          }
        }
      }
      setShowSettingsMenu(false);
      setActiveMenuTab('main');
    };

    const handleSelectSubtitle = (subId: string) => {
      setSelectedSubtitleId(subId);
      setShowSettingsMenu(false);
      setActiveMenuTab('main');
    };

    // Controls display auto-fadeout
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = window.setTimeout(() => {
        if (isPlaying && !showSettingsMenu) {
          setShowControls(false);
        }
      }, 3500);
    };

    // Fullscreen listener
    useEffect(() => {
      const handleFsChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFsChange);
      };
    }, []);

    const toggleFullscreen = async () => {
      if (!containerRef.current) return;
      try {
        if (!document.fullscreenElement) {
          await containerRef.current.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      } catch (e) {
        console.error('Fullscreen toggle error:', e);
      }
    };

    const togglePiP = async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
        }
      } catch (e) {
        console.error('PiP error:', e);
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setVolume(val);
      if (videoRef.current) {
        videoRef.current.volume = val;
        videoRef.current.muted = val === 0;
        setIsMuted(val === 0);
      }
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    };

    const formatTime = (secs: number) => {
      if (isNaN(secs) || secs < 0) return '00:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      const h = Math.floor(m / 60);
      const remM = m % 60;
      if (h > 0) {
        return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
      return `${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleAdminScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isAdmin || !onAdminSeek) return;
      onAdminSeek(parseFloat(e.target.value));
    };

    // Native <video> error handler
    const handleNativeVideoError = () => {
      setIsBuffering(false);
      const err = videoRef.current?.error;
      if (!err) {
        setVideoError({
          title: 'Playback Failure',
          message: 'Unable to load video stream. Please check video URL or network connectivity.',
          category: 'generic',
        });
        return;
      }

      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          setVideoError({
            title: 'Playback Aborted',
            message: 'Video playback was aborted by the browser or user.',
            category: 'generic',
          });
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          setVideoError({
            title: 'Network / CORS Error',
            message:
              'A network error occurred or the video server failed to send CORS headers. Verify that the video host allows cross-origin requests.',
            category: 'cors',
          });
          break;
        case MediaError.MEDIA_ERR_DECODE:
          setVideoError({
            title: 'Media Codec / Decode Error',
            message:
              'The video file container or audio/video codec is not supported by your browser or is corrupted.',
            category: 'codec',
          });
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          setVideoError({
            title: 'Source Unavailable or Format Unsupported',
            message:
              'The video URL could not be found (404), was forbidden (403), or the container format is not supported.',
            category: 'format',
          });
          break;
        default:
          setVideoError({
            title: 'Video Error',
            message: err.message || 'An unexpected error occurred while loading the video stream.',
            category: 'generic',
          });
      }
    };

    const activeSubtitleObj = subtitles.find((s) => s.id === selectedSubtitleId);
    const qualitiesList = detectedQualities.length > 0 ? detectedQualities : availableQualities;

    return (
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && !showSettingsMenu && setShowControls(false)}
        className="relative w-full aspect-video bg-neutral-950 rounded-2xl overflow-hidden group select-none shadow-2xl border border-neutral-800/80"
      >
        {/* HTML5 Video Element */}
        <video
          ref={videoRef}
          playsInline
          crossOrigin="anonymous"
          poster={poster}
          className="w-full h-full object-contain"
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            setVideoError(null);
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (videoRef.current) {
              const cur = videoRef.current.currentTime;
              const dur = videoRef.current.duration || 0;
              setCurrentTime(cur);
              setDuration(dur);
              onTimeUpdate?.(cur, dur);
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              setIsBuffering(false);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          onError={handleNativeVideoError}
        >
          {/* Subtitle WebVTT Tracks */}
          {subtitles.map((sub) => (
            <track
              key={sub.id}
              kind="subtitles"
              label={sub.label}
              srcLang={sub.languageCode}
              src={sub.fileUrl}
              default={sub.isDefault && selectedSubtitleId === 'off'}
            />
          ))}
        </video>

        {/* Buffering Indicator */}
        {isBuffering && !videoError && !autoplayBlocked && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border-3 border-rose-500/30 border-t-rose-500 animate-spin" />
              <span className="text-xs font-semibold tracking-wider text-neutral-300 uppercase">
                {syncStatus === 'reconnecting' ? 'Reconnecting live stream…' : 'Buffering live stream…'}
              </span>
            </div>
          </div>
        )}

        {/* Detailed Video Error Message Overlay */}
        {videoError && (
          <div className="absolute inset-0 z-35 flex items-center justify-center bg-neutral-950/95 p-6 text-center">
            <div className="max-w-lg flex flex-col items-center gap-3.5 p-6 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    {getSourceTypeLabel(detectedType)}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-semibold uppercase">
                    {videoError.category}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white tracking-tight">{videoError.title}</h4>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-md">
                {videoError.message}
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={initializePlayer}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Connection</span>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => window.open(src, '_blank')}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Inspect URL in New Tab
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Autoplay Blocked Interstitial */}
        {autoplayBlocked && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-sm p-6 text-center">
            <div className="flex flex-col items-center max-w-sm gap-4 p-6 bg-neutral-900/90 border border-neutral-700/80 rounded-2xl shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center animate-pulse">
                <Play className="w-8 h-8 ml-1 fill-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Click to Start Watching</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Browser audio policy requires a quick click to join the live broadcast.
                </p>
              </div>
              <button
                onClick={onAutoplayUnlock}
                className="w-full py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95"
              >
                Start Watching Live
              </button>
            </div>
          </div>
        )}

        {/* Top Badges: LIVE 🔴 & Source Type & Sync Status */}
        <div className="absolute top-4 left-4 z-25 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-bold tracking-wide uppercase shadow-lg shadow-rose-600/30 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>LIVE</span>
          </div>

          {/* Detected Format Badge */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900/80 border border-neutral-700/60 text-neutral-300 text-[11px] font-medium backdrop-blur-md">
            <Film className="w-3 h-3 text-rose-400" />
            <span>{getSourceTypeLabel(detectedType)}</span>
          </div>

          {syncStatus === 'reconnecting' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold backdrop-blur-md animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Reconnecting…</span>
            </div>
          ) : isSyncing ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>Syncing…</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Synced</span>
            </div>
          )}

          {isAdmin && (
            <div className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
              Host Controller
            </div>
          )}
        </div>

        {/* Active Subtitle Chip (Top Right) */}
        {selectedSubtitleId !== 'off' && activeSubtitleObj && (
          <div className="absolute top-4 right-4 z-25 px-2.5 py-1 rounded-lg bg-black/60 border border-neutral-700/80 text-[11px] text-neutral-200 backdrop-blur-md flex items-center gap-1.5">
            <Subtitles className="w-3 h-3 text-indigo-400" />
            <span>{activeSubtitleObj.label}</span>
          </div>
        )}

        {/* Settings Flyout Menu */}
        {showSettingsMenu && (
          <div className="absolute bottom-16 right-4 z-40 w-56 rounded-2xl bg-neutral-900/95 border border-neutral-700 p-3 shadow-2xl backdrop-blur-md text-xs">
            {activeMenuTab === 'main' && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Playback Settings
                </div>

                {/* Quality Item */}
                <button
                  onClick={() => setActiveMenuTab('quality')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <span className="font-medium">Quality</span>
                  <span className="text-neutral-400">{selectedQuality} ›</span>
                </button>

                {/* Subtitles Item */}
                <button
                  onClick={() => setActiveMenuTab('subtitles')}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <span className="font-medium">Subtitles</span>
                  <span className="text-neutral-400">
                    {selectedSubtitleId === 'off' ? 'Off' : activeSubtitleObj?.languageName || 'On'} ›
                  </span>
                </button>

                {/* Source Format Details */}
                <div className="px-3 py-2 text-[11px] text-neutral-500 border-t border-neutral-800 flex justify-between">
                  <span>Stream Type</span>
                  <span className="font-mono text-neutral-300">{getSourceTypeLabel(detectedType)}</span>
                </div>
              </div>
            )}

            {/* Quality Submenu */}
            {activeMenuTab === 'quality' && (
              <div className="space-y-1">
                <button
                  onClick={() => setActiveMenuTab('main')}
                  className="px-2 py-1 text-neutral-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer mb-1"
                >
                  ‹ Quality
                </button>
                <button
                  onClick={() => handleSelectQuality('Auto')}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-neutral-800 text-neutral-200 cursor-pointer"
                >
                  <span>Auto (Adaptive)</span>
                  {selectedQuality === 'Auto' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
                {qualitiesList.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSelectQuality(q)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-neutral-800 text-neutral-200 cursor-pointer"
                  >
                    <span>{q}</span>
                    {selectedQuality === q && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}

            {/* Subtitles Submenu */}
            {activeMenuTab === 'subtitles' && (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                <button
                  onClick={() => setActiveMenuTab('main')}
                  className="px-2 py-1 text-neutral-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer mb-1"
                >
                  ‹ Subtitles
                </button>
                <button
                  onClick={() => handleSelectSubtitle('off')}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-neutral-800 text-neutral-200 cursor-pointer"
                >
                  <span>Off</span>
                  {selectedSubtitleId === 'off' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
                {subtitles.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSelectSubtitle(sub.id)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-neutral-800 text-neutral-200 cursor-pointer"
                  >
                    <span>{sub.label}</span>
                    {selectedSubtitleId === sub.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Video Controls Bar */}
        <div
          className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Scrubber / Progress Bar */}
          <div className="space-y-1.5 mb-2">
            {isAdmin ? (
              <div className="relative group/scrub flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={handleAdminScrubberChange}
                  className="w-full h-1.5 bg-neutral-700/80 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:h-2.5 transition-all"
                />
              </div>
            ) : (
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-200"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-rose-500" />
                <span>{formatTime(currentTime)}</span>
              </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls Buttons */}
          <div className="flex items-center justify-between gap-4">
            {/* Left Controls */}
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <>
                  <button
                    onClick={() => {
                      if (isPlaying) {
                        onAdminPause?.();
                      } else {
                        onAdminPlay?.();
                      }
                    }}
                    title={isPlaying ? 'Pause broadcast' : 'Play broadcast'}
                    className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                  </button>

                  <button
                    onClick={() => onAdminSeek?.(Math.max(0, currentTime - 10))}
                    title="Rewind 10s"
                    className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                  >
                    <Rewind className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onAdminSeek?.(Math.min(duration, currentTime + 10))}
                    title="Fast forward 10s"
                    className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={onAdminRestart}
                    title="Restart movie"
                    className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-semibold text-white truncate max-w-[200px]">{title || 'Live Stream'}</span>
                </div>
              )}
            </div>

            {/* Right Controls: Volume, CC, Settings, PiP, Fullscreen */}
            <div className="flex items-center gap-2.5">
              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 group/vol">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-rose-500 group-hover/vol:w-22 transition-all"
                />
              </div>

              {/* CC Subtitles Button (1-Click toggle) */}
              {subtitles.length > 0 && (
                <button
                  onClick={() => {
                    if (selectedSubtitleId === 'off') {
                      setSelectedSubtitleId(subtitles[0].id);
                    } else {
                      setSelectedSubtitleId('off');
                    }
                  }}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    selectedSubtitleId !== 'off'
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                  }`}
                  title="Toggle Subtitles (CC)"
                >
                  <Subtitles className="w-4 h-4" />
                </button>
              )}

              {/* Settings Menu Button (Quality, Subtitles) */}
              <button
                onClick={() => {
                  setShowSettingsMenu(!showSettingsMenu);
                  setActiveMenuTab('main');
                }}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  showSettingsMenu
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-800/80'
                }`}
                title="Player Settings (Quality, Subtitles)"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Picture in Picture */}
              <button
                onClick={togglePiP}
                className="hidden sm:block p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                title="Picture-in-Picture"
              >
                <Tv className="w-4 h-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
