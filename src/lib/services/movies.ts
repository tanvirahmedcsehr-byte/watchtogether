import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { Movie } from '../../types';
import { isApplicationAdminLoggedIn, ADMIN_AUTH_KEY } from '../auth/AuthContext';
import { addSubtitle, createVttDataUri, generateSampleVtt } from './subtitles';
import { defaultVideoProcessor, extractGoogleDriveFileId } from '../video/processor';

export const INITIAL_SEED_MOVIES: Omit<Movie, 'id'>[] = [
  {
    title: 'Interstellar - Space Odyssey',
    description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity’s survival, exploring cosmic horizons and temporal distortion.',
    posterUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    googleDriveFileId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs',
    originalFileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    genre: 'Sci-Fi / Adventure',
    duration: '12m 14s',
    durationSeconds: 734,
    releaseYear: '2024',
    language: 'English',
    rating: 'PG-13',
    status: 'active',
    processingStatus: 'READY',
    availableQualities: '1080p,720p,480p,360p',
  },
  {
    title: 'Big Buck Bunny',
    description: 'A large and lovable rabbit deals with bullying forest creatures in this classic open-source animated comedy by the Blender Institute.',
    posterUrl: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800&auto=format&fit=crop&q=80',
    googleDriveFileId: '1C9mFwQ_bunny_master_raw',
    originalFileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    genre: 'Animation / Comedy',
    duration: '9m 56s',
    durationSeconds: 596,
    releaseYear: '2008',
    language: 'English',
    rating: 'G',
    status: 'active',
    processingStatus: 'READY',
    availableQualities: '1080p,720p,480p,360p',
  },
  {
    title: 'Sintel - The Dragon Hunt',
    description: 'A lonely young woman named Sintel searches the desolate wilderness for a baby dragon companion that was taken from her.',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    googleDriveFileId: '1D8x_sintel_master_raw',
    originalFileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    genre: 'Fantasy / Action',
    duration: '14m 48s',
    durationSeconds: 888,
    releaseYear: '2010',
    language: 'English',
    rating: 'PG',
    status: 'active',
    processingStatus: 'READY',
    availableQualities: '1080p,720p,480p,360p',
  },
  {
    title: 'Elephants Dream',
    description: 'The world’s first open movie, exploring the surreal mechanical labyrinth created by the eccentric Proog and his apprentice Emo.',
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
    googleDriveFileId: '1E5v_elephants_master_raw',
    originalFileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    genre: 'Sci-Fi / Drama',
    duration: '10m 54s',
    durationSeconds: 654,
    releaseYear: '2006',
    language: 'English',
    rating: 'PG-13',
    status: 'active',
    processingStatus: 'READY',
    availableQualities: '720p,480p,360p',
  },
];

function assertAdminSession(operationName: string) {
  if (!isApplicationAdminLoggedIn() && !auth.currentUser) {
    throw new Error(
      `Unable to ${operationName}: You must be logged in as an administrator (Username: Tanvir, Password: Movie).`
    );
  }
}

export async function getMovies(): Promise<Movie[]> {
  try {
    const snap = await getDocs(collection(db, 'movies'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Movie[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'movies');
  }
}

export async function getMovie(id: string): Promise<Movie | null> {
  try {
    const snap = await getDoc(doc(db, 'movies', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Movie;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `movies/${id}`);
  }
}

export async function createMovie(movie: Omit<Movie, 'id'>): Promise<string> {
  assertAdminSession('create movie');
  const movieRef = doc(collection(db, 'movies'));
  try {
    const now = new Date().toISOString();
    await setDoc(movieRef, {
      ...movie,
      adminAuthKey: ADMIN_AUTH_KEY,
      createdAt: now,
      updatedAt: now,
    });
    return movieRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `movies/${movieRef.id}`);
  }
}

export async function updateMovie(id: string, updates: Partial<Movie>): Promise<void> {
  assertAdminSession('update movie');
  try {
    const docRef = doc(db, 'movies', id);
    await updateDoc(docRef, {
      ...updates,
      adminAuthKey: ADMIN_AUTH_KEY,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `movies/${id}`);
  }
}

export async function deleteMovie(id: string): Promise<void> {
  assertAdminSession('delete movie');
  try {
    await deleteDoc(doc(db, 'movies', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `movies/${id}`);
  }
}

export async function importMovieFromGoogleDrive(
  driveFileIdOrUrl: string,
  movieInfo: {
    title: string;
    description?: string;
    posterUrl?: string;
    genre?: string;
    releaseYear?: string;
    duration?: string;
  }
): Promise<string> {
  assertAdminSession('import movie from Google Drive');
  const fileId = extractGoogleDriveFileId(driveFileIdOrUrl);
  const now = new Date().toISOString();

  // Create initial movie in IMPORTING state
  const movieRef = doc(collection(db, 'movies'));
  const initialMovieData: Omit<Movie, 'id'> = {
    title: movieInfo.title.trim() || `Drive Film (${fileId.substring(0, 8)})`,
    description: movieInfo.description || '',
    posterUrl: movieInfo.posterUrl || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
    googleDriveFileId: fileId,
    originalFileUrl: `https://drive.google.com/file/d/${fileId}/view`,
    streamUrl: '',
    genre: movieInfo.genre || 'Feature',
    duration: movieInfo.duration || '15m 00s',
    releaseYear: movieInfo.releaseYear || String(new Date().getFullYear()),
    status: 'active',
    processingStatus: 'IMPORTING',
    availableQualities: '1080p,720p,480p,360p',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(movieRef, initialMovieData);
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, `movies/${movieRef.id}`);
  }

  // Trigger processor pipeline
  const job = await defaultVideoProcessor.importFromGoogleDrive(fileId, {
    id: movieRef.id,
    ...initialMovieData,
  });

  // Run transcode pipeline asynchronously
  defaultVideoProcessor
    .processVideo(job, { sourceResolution: '1080p' })
    .then(async (finishedJob) => {
      try {
        await updateDoc(movieRef, {
          processingStatus: finishedJob.status,
          streamUrl:
            finishedJob.streamUrl ||
            'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
          availableQualities: finishedJob.generatedQualities.join(','),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to update processed movie record:', err);
      }
    });

  return movieRef.id;
}

export async function seedSampleMoviesWithSubtitles(): Promise<void> {
  assertAdminSession('seed sample movies');
  for (const movieData of INITIAL_SEED_MOVIES) {
    const movieId = await createMovie(movieData);

    // Seed Multilingual Subtitles for this movie (English, Bengali, Hindi, Spanish)
    const languages = [
      { code: 'en', name: 'English', label: 'English', default: true },
      { code: 'bn', name: 'Bengali', label: 'বাংলা (Bengali)', default: false },
      { code: 'hi', name: 'Hindi', label: 'हिंदी (Hindi)', default: false },
      { code: 'es', name: 'Spanish', label: 'Español (Spanish)', default: false },
    ];

    for (const lang of languages) {
      const vtt = generateSampleVtt(lang.name, movieData.title);
      await addSubtitle(movieId, {
        languageCode: lang.code,
        languageName: lang.name,
        label: lang.label,
        fileUrl: createVttDataUri(vtt),
        isDefault: lang.default,
      });
    }
  }
}
