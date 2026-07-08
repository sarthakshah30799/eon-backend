import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
    isAdmin?: boolean;
    activeBranchId?: string | null;
    activeCounterId?: string | null;
    pendingPasswordSetupUserId?: string | null;
    pendingPasswordSetupEmail?: string | null;
    lastActivityAt?: number;
  }
}
