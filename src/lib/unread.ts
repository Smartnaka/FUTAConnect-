const lastReadKey = (matchId: string) => `futaconnect_lastread_${matchId}`;

export function getLastRead(matchId: string): number {
  try {
    return parseInt(localStorage.getItem(lastReadKey(matchId)) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function markAsRead(matchId: string) {
  try {
    localStorage.setItem(lastReadKey(matchId), Date.now().toString());
  } catch {
    // Ignore
  }
}
