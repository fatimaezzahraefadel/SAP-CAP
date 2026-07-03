import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole } from '../context/roleRouting';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import inetumLogoDark from '@/assets/inetum-logo-dark.svg';
import inetumLogoLight from '@/assets/inetum-logo.svg';

// Local demo accounts (dev server only). Mirrors the backend's
// DEMO_PASSWORD_BY_EMAIL in srv/auth/auth.domain.service.js.
const DEMO_ACCOUNTS: { label: string; email: string; password: string }[] = [
  { label: 'Admin', email: 'alice.admin@inetum.com', password: 'Admin#2026' },
  { label: 'Manager', email: 'marc.manager@inetum.com', password: 'Manager#2026' },
  { label: 'Project Manager', email: 'pierre.pm@inetum.com', password: 'PM#2026' },
  { label: 'Dev Coordinator', email: 'diana.devco@inetum.com', password: 'DevCo#2026' },
  { label: 'Consultant Technique', email: 'theo.tech@inetum.com', password: 'Tech#2026' },
  { label: 'Consultant Fonctionnel', email: 'fatima.fonc@inetum.com', password: 'Func#2026' },
];

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, isAuthenticated, isAuthLoading, login, loginWithCredentials, isDevLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      navigate(fromPath || getDefaultRouteForRole(currentUser.role), { replace: true });
    }
  }, [currentUser, fromPath, isAuthenticated, navigate]);

  const handleDemoLogin = async (email: string, password: string) => {
    setPendingEmail(email);
    try {
      await loginWithCredentials(email, password);
    } catch {
      toast.error(t('login.demoLoginFailed') || 'Connexion impossible');
    } finally {
      setPendingEmail(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8 sm:px-6">
        <Card className="w-full border-border/80 bg-card">
          <CardHeader className="space-y-5">
            <div>
              <img src={inetumLogoDark} alt="Inetum" className="h-8 w-auto dark:hidden" />
              <img src={inetumLogoLight} alt="Inetum" className="hidden h-8 w-auto dark:block" />
            </div>
            <div className="space-y-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('login.accountAccess')}
              </p>
              <CardTitle className="text-2xl">{t('login.signIn')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('login.sapLoginRequired')}</p>
            </div>
          </CardHeader>
          <CardContent>
            {isDevLogin ? (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('login.demoModeTitle') || 'Mode démo local — choisissez un rôle'}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <Button
                      key={account.email}
                      variant="outline"
                      className="justify-start"
                      disabled={isAuthLoading}
                      onClick={() => void handleDemoLogin(account.email, account.password)}
                    >
                      {pendingEmail === account.email ? t('common.loadingSession') : account.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('login.demoModeHint') || 'Authentification locale mockée (sans SAP BTP).'}
                </p>
              </div>
            ) : (
              <>
                <Button className="w-full" size="lg" onClick={() => void login()} disabled={isAuthLoading}>
                  {isAuthLoading ? t('common.loadingSession') : t('login.continueWithSap')}
                </Button>
                {!isAuthLoading && !currentUser ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t('login.missingRoleCollection')}
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
