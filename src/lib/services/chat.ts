import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limitToLast,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { ChatMessage } from '../../types';
import { isApplicationAdminLoggedIn } from '../auth/AuthContext';

function assertAdminSession(action: string) {
  if (!isApplicationAdminLoggedIn() && !auth.currentUser) {
    throw new Error(`Unable to ${action}: You must be logged in as an administrator (Username: Tanvir, Password: Movie).`);
  }
}

export async function sendChatMessage(
  sessionId: string,
  displayLabel: string,
  rawText: string
): Promise<void> {
  const clean = rawText.trim().slice(0, 500);
  if (!clean) return;

  const messagesRef = collection(db, 'chatMessages');
  try {
    await addDoc(messagesRef, {
      sessionId,
      displayLabel: displayLabel.slice(0, 50),
      message: clean,
      createdAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'chatMessages');
  }
}

export function subscribeToChatMessages(
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (err: any) => void
): () => void {
  const messagesRef = collection(db, 'chatMessages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), limitToLast(80));

  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ChatMessage[];
      onMessages(msgs);
    },
    (error) => {
      console.error('Chat messages listener error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'chatMessages');
    }
  );
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  assertAdminSession('delete chat message');
  try {
    await deleteDoc(doc(db, 'chatMessages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `chatMessages/${messageId}`);
  }
}

export async function clearAllChat(): Promise<void> {
  assertAdminSession('clear chat history');
  try {
    const snap = await getDocs(collection(db, 'chatMessages'));
    const promises = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'chatMessages');
  }
}
