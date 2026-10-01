export type ProcessingStatus = 'UPLOADING' | 'IMPORTING' | 'PROCESSING' | 'READY' | 'FAILED';

export type VideoSourceType =
  | 'hls'          // HLS .m3u8 adaptive stream
  | 'mp4'          // Direct MP4 video (video/mp4)
  | 'webm'         // Direct WebM video (video/webm)
  | 'ogg'          // Direct Ogg video (video/ogg)
  | 'dash'         // MPEG-DASH (.mpd)
  | 'google-drive' // Google Drive link (viewer or uc download)
  | 'webpage'      // Webpage URL (YouTube, Facebook, Netflix, etc.)
  | 'unknown';

export type ValidationStatus =
  | 'READY'
  | 'INVALID_URL'
  | 'UNSUPPORTED_SOURCE'
  | 'SOURCE_UNAVAILABLE'
  | 'CORS_BLOCKED'
  | 'HLS_ERROR'
  | 'MEDIA_FORMAT_ERROR'
  | 'CHECKING';

export interface Movie {
  id: string;
  title: string;
  description: string;
  posterUrl: string;
  thumbnail?: string;
  googleDriveFileId?: string;
  originalFileUrl?: string;
  streamUrl: string;
  duration: string;
  durationSeconds?: number;
  genre?: string;
  releaseYear?: string;
  language?: string;
  rating?: string;
  status: 'active' | 'inactive';
  processingStatus: ProcessingStatus;
  availableQualities?: string; // e.g. "1080p,720p,480p,360p"
  sourceType?: VideoSourceType;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  subtitles?: Subtitle[];
  adminAuthKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subtitle {
  id: string;
  movieId: string;
  languageCode: string; // "bn", "en", "hi", "es", "ar"
  languageName: string; // "Bengali", "English", "Hindi", "Spanish", "Arabic"
  label: string;
  fileUrl: string; // WebVTT URL or data URI
  isDefault: boolean;
  adminAuthKey?: string;
  createdAt?: string;
}

export type LiveStatus = 'LIVE' | 'PAUSED' | 'OFFLINE' | 'ENDED';

export interface LiveState {
  movieId: string | null;
  movieTitle?: string;
  isPlaying: boolean;
  position: number;
  updatedAtMillis: number;
  status: LiveStatus;
  controllerId?: string;
  startedAtMillis?: number;
  adminAuthKey?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  displayLabel: string;
  message: string;
  createdAt: number;
  adminAuthKey?: string;
}

export interface PlatformSettings {
  platformName: string;
  logoUrl?: string;
  chatEnabled: boolean;
  defaultQuality: string;
  adminAuthKey?: string;
}
