export type AuthMode = 'login' | 'register' | 'forgot';
export const authRoutes: Record<AuthMode, string> = {
  login: 'signin',
  register: 'register',
  forgot: 'forgot',
};
export function authMode(route: string): AuthMode {
  const root = route.split('/')[0];
  return root === 'register' ? 'register' : root === 'forgot' ? 'forgot' : 'login';
}

export function appView({
  authLoading,
  signedIn,
  recovery,
  route,
  needsProfile = false,
}: {
  authLoading: boolean;
  signedIn: boolean;
  recovery: boolean;
  route: string;
  needsProfile?: boolean;
}): 'loading' | 'auth' | 'information' | 'onboarding' | 'dashboard' {
  if (authLoading) return 'loading';
  if (
    (!signedIn || recovery || needsProfile) &&
    ['privacy', 'terms', 'help'].includes(route.split('/')[0])
  )
    return 'information';
  if (!signedIn || recovery) return 'auth';
  if (needsProfile) return 'onboarding';
  return 'dashboard';
}

export function afterSignIn(verification: string) {
  return verification === 'draft' ? 'account' : 'home';
}
