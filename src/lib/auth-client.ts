// Browser-side Better Auth client. Used inside Svelte components for
// sign-in / sign-out / session subscription via runes.

import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession, changePassword } = authClient;
