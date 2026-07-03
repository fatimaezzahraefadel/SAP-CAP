import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getDefaultRouteForRole } from '../context/roleRouting';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import inetumLogoDark from '@/assets/inetum-logo-dark.svg';
import inetumLogoLight from '@/assets/inetum-logo.svg';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, isAuthenticated, isAuthLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      navigate(fromPath || getDefaultRouteForRole(currentUser.role), { replace: true });
    }
  }, [currentUser, fromPath, isAuthenticated, navigate]);

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
            <Button className="w-full" size="lg" onClick={() => void login()} disabled={isAuthLoading}>
              {isAuthLoading ? t('common.loadingSession') : t('login.continueWithSap')}
            </Button>
            {!isAuthLoading && !currentUser ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('login.missingRoleCollection')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
