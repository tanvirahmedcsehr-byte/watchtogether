export interface ViewerSession {
  sessionId: string;
  displayLabel: string;
}

export function getOrCreateViewerSession(): ViewerSession {
  const key = 'wt_live_viewer_session';
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.sessionId && parsed.displayLabel) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  const randomNum = Math.floor(1 + Math.random() * 99);
  const sessionId = 'v_' + Math.random().toString(36).substring(2, 10);
  const displayLabel = `Viewer ${randomNum}`;

  const session: ViewerSession = {
    sessionId,
    displayLabel,
  };

  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch (e) {
    // ignore
  }

  return session;
}
