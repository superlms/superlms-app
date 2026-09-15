// ─────────────────────────────────────────────────────────────────────────────
//  Live chat wiring.
//
//  A chat push (type chat_message) tells whichever chat screen is open to fetch
//  at once rather than wait for its next check, and the conversation that is on
//  screen takes its new message without a banner — you are already reading it.
// ─────────────────────────────────────────────────────────────────────────────

type Listener = (fromUserId: number) => void;

const listeners = new Set<Listener>();
let openWith: number | null = null;

/** Listen for chat pushes; returns the unsubscribe. */
export const onChatPush = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitChatPush = (fromUserId: number) => listeners.forEach(listener => listener(fromUserId));

/** The person whose conversation is on screen, or null once it closes. */
export const setOpenChat = (userId: number | null) => {
  openWith = userId;
};

export const isChatOpenWith = (userId: number) => openWith === userId;
