import { useLayoutEffect, useState, type ReactNode } from 'react';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import {
  agentsQueryClient,
  CHAT_PANEL_STORAGE_KEY,
  ChatProvider,
} from '@nocobase/app-plugin-agents/client/chat';

/** One chat controller per signed-in identity; clear the SDK's unscoped cache on account changes. */
export function AgentsProvider({ children }: { children: ReactNode }) {
  const { session, isPending } = useAuthentication();
  const userId = isPending ? null : session?.user.id;
  return userId ? (
    <IdentityChat key={userId} userId={userId}>
      {children}
    </IdentityChat>
  ) : (
    <>{children}</>
  );
}

function IdentityChat({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const reset = () => {
      try {
        window.sessionStorage.removeItem(CHAT_PANEL_STORAGE_KEY);
      } catch {
        /* Storage can be unavailable. */
      }
      agentsQueryClient().clear();
    };
    reset();
    let active = true;
    queueMicrotask(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
      reset();
    };
  }, []);
  return ready ? (
    <ChatProvider memoryScope={userId}>{children}</ChatProvider>
  ) : null;
}
