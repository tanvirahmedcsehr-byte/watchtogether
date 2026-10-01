import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { PlatformSettings } from '../../types';
import { isApplicationAdminLoggedIn, ADMIN_AUTH_KEY } from '../auth/AuthContext';

export const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'CineLive',
  logoUrl: '',
  chatEnabled: true,
  defaultQuality: 'Auto',
};

function assertAdminSession(action: string) {
  if (!isApplicationAdminLoggedIn() && !auth.currentUser) {
    throw new Error(`Unable to ${action}: You must be logged in as an administrator (Username: Tanvir, Password: Movie).`);
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (!snap.exists()) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...snap.data() } as PlatformSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'settings/global');
  }
}

export async function updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<void> {
  assertAdminSession('update platform settings');
  try {
    await setDoc(doc(db, 'settings', 'global'), {
      ...settings,
      adminAuthKey: ADMIN_AUTH_KEY,
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/global');
  }
}
