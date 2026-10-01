/**
 * Common application session context shared by controllers and services.
 * Express session properties remain optional because authentication guards
 * run before business services and session data is populated at runtime.
 */
export interface SessionContext {
  userId?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  isHo?: boolean;
  isHoStaff?: boolean;
  activeBranchId?: string | null;
  activeCounterId?: string | null;
}

/** Session context after an authentication guard has established the user. */
export interface AuthenticatedSession extends SessionContext {
  userId: string;
}
