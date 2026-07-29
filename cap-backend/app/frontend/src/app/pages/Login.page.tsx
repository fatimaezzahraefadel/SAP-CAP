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
import { TestUser } from '../services/odata/core';

const testUsers: TestUser[] = [
  { id: 'u-admin', email: 'alice.admin@inetum.com', name: 'Alice Admin', role: 'ADMIN' },
  { id: 'u-manager', email: 'marc.manager@inetum.com', name: 'Marc Manager', role: 'MANAGER' },
  { id: 'u-tech', email: 'theo.tech@inetum.com', name: 'Theo Technique', role: 'CONSULTANT_TECHNIQUE' },
  { id: 'u-func', email: 'fatima.fonc@inetum.com', name: 'Fatima Fonctionnel', role: 'CONSULTANT_FONCTIONNEL' },
  { id: 'u-pm', email: 'pierre.pm@inetum.com', name: 'Pierre PM', role: 'PROJECT_MANAGER' },
  { id: 'u-devco', email: 'diana.devco@inetum.com', name: 'Diana DevCo', role: 'DEV_COORDINATOR' },
];

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, isAuthenticated, isAuthLoading, login, loginAsTestUser } = useAuth();
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
              <p className="text-sm text-muted-foreground">Sélectionnez un utilisateur de test</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {testUsers.map((user) => (
              <Button
                key={user.id}
                className="w-full justify-start text-left"
                size="lg"
                onClick={() => void loginAsTestUser(user)}
                disabled={isAuthLoading}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.role}</span>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
