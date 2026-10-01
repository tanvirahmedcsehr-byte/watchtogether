import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { Subtitle } from '../../types';
import { isApplicationAdminLoggedIn, ADMIN_AUTH_KEY } from '../auth/AuthContext';

function assertAdminSession(action: string) {
  if (!isApplicationAdminLoggedIn() && !auth.currentUser) {
    throw new Error(`Unable to ${action}: You must be logged in as an administrator (Username: Tanvir, Password: Movie).`);
  }
}

// Convert WebVTT content to a playable data URI
export function createVttDataUri(vttContent: string): string {
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vttContent)}`;
}

export function generateSampleVtt(languageName: string, movieTitle: string): string {
  const isBengali = languageName.toLowerCase().includes('bengali') || languageName.toLowerCase().includes('বাংলা');
  const isHindi = languageName.toLowerCase().includes('hindi') || languageName.toLowerCase().includes('हिंदी');
  const isSpanish = languageName.toLowerCase().includes('spanish') || languageName.toLowerCase().includes('español');

  if (isBengali) {
    return `WEBVTT - ${movieTitle} (বাংলা)

00:00:02.000 --> 00:00:07.000
সিনেলাইভ (CineLive) লাইভ স্ট্রিমিংয়ে আপনাকে স্বাগতম।

00:00:08.500 --> 00:00:14.000
আমরা এখন উপভোগ করছি: ${movieTitle}।

00:00:15.000 --> 00:00:22.000
সমস্ত দর্শক একই সাথে রিয়েল-টাইমে উপভোগ করছেন।

00:00:25.000 --> 00:00:32.000
এইচডি গুণমান এবং সাবটাইটেল উপলব্ধ।

00:00:35.000 --> 00:00:45.000
শান্ত থাকুন এবং চলচ্চিত্র উপভোগ করুন!`;
  }

  if (isHindi) {
    return `WEBVTT - ${movieTitle} (हिंदी)

00:00:02.000 --> 00:00:07.000
सिनेलाइव (CineLive) लाइव स्ट्रीमिंग में आपका स्वागत है।

00:00:08.500 --> 00:00:14.000
हम देख रहे हैं: ${movieTitle}।

00:00:15.000 --> 00:00:22.000
सभी दर्शक एक ही समय में लाइव देख रहे हैं।

00:00:25.000 --> 00:00:32.000
एचडी गुणवत्ता और उपशीर्षक सक्रिय हैं।

00:00:35.000 --> 00:00:45.000
आनंद लें और साथ में देखें!`;
  }

  if (isSpanish) {
    return `WEBVTT - ${movieTitle} (Español)

00:00:02.000 --> 00:00:07.000
Bienvenidos a la transmisión en vivo de CineLive.

00:00:08.500 --> 00:00:14.000
Estamos viendo: ${movieTitle}.

00:00:15.000 --> 00:00:22.000
Todos los espectadores disfrutan sincronizados en tiempo real.

00:00:25.000 --> 00:00:32.000
Calidad HD y subtítulos disponibles.

00:00:35.000 --> 00:00:45.000
¡Disfruten de la película juntos!`;
  }

  // English default
  return `WEBVTT - ${movieTitle} (English)

00:00:02.000 --> 00:00:07.000
Welcome to CineLive Private Live Channel.

00:00:08.500 --> 00:00:14.000
Now Playing: ${movieTitle}.

00:00:15.000 --> 00:00:22.000
All viewers are synchronized to the host authoritative stream.

00:00:25.000 --> 00:00:32.000
Adjust quality and subtitles anytime from the player settings.

00:00:35.000 --> 00:00:45.000
Sit back, relax, and enjoy the show!`;
}

export async function getSubtitlesForMovie(movieId: string): Promise<Subtitle[]> {
  try {
    const snap = await getDocs(collection(db, 'movies', movieId, 'subtitles'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Subtitle[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `movies/${movieId}/subtitles`);
  }
}

export async function addSubtitle(
  movieId: string,
  data: Omit<Subtitle, 'id' | 'movieId' | 'createdAt'>
): Promise<string> {
  assertAdminSession('add subtitle');
  const subRef = doc(collection(db, 'movies', movieId, 'subtitles'));
  try {
    const newSub: Subtitle = {
      id: subRef.id,
      movieId,
      ...data,
      adminAuthKey: ADMIN_AUTH_KEY,
      createdAt: new Date().toISOString(),
    };
    await setDoc(subRef, newSub);
    return subRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `movies/${movieId}/subtitles/${subRef.id}`);
  }
}

export async function deleteSubtitle(movieId: string, subtitleId: string): Promise<void> {
  assertAdminSession('delete subtitle');
  try {
    await deleteDoc(doc(db, 'movies', movieId, 'subtitles', subtitleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `movies/${movieId}/subtitles/${subtitleId}`);
  }
}
