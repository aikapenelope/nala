/**
 * Authentication routes.
 *
 * Previously contained owner PIN verification endpoints.
 * These have been removed as part of the auth simplification:
 * every user (owner and employee) now authenticates directly
 * with their own Clerk JWT. PIN-based auth is no longer used.
 *
 * Owner-restricted actions (void sale, etc.) are now enforced
 * by checking the user's role in the route handler.
 */
