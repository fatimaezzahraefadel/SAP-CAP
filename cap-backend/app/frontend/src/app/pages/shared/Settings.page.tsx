import React, { useEffect, useState } from 'react';
import { Bell, Globe, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';

interface LocalSettings {
  leaveRequestNotif: boolean;
  certificationNotif: boolean;
}

const STORAGE_KEY = 'appSettings';

const DEFAULT_SETTINGS: LocalSettings = {
  leaveRequestNotif: true,
  certificationNotif: true,
};

const getInitialSettings = (): LocalSettings => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      leaveRequestNotif: typeof parsed.leaveRequestNotif === 'boolean' ? parsed.leaveRequestNotif : DEFAULT_SETTINGS.leaveRequestNotif,
      certificationNotif: typeof parsed.certificationNotif === 'boolean' ? parsed.certificationNotif : DEFAULT_SETTINGS.certificationNotif,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_SETTINGS;
  }
};

export const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<LocalSettings>(getInitialSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const changeLanguage = (lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeader
        title={t('common.settings')}
        subtitle={t('settings.subtitle')}
        breadcrumbs={[{ label: t('common.settings') }]}
      />

      <div className="mx-auto grid max-w-4xl gap-6 p-6 lg:p-8">
        <Card className="bg-card/92">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-xl">
              <Palette className="h-4 w-4 text-primary" />
              {t('settings.appearance')}
            </CardTitle>
            <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-2 p-4">
            <div>
              <p id="settings-theme-label" className="font-semibold text-foreground">
                {t('settings.theme')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('settings.currentMode')}: {theme === 'dark' ? t('settings.dark') : t('settings.light')}
              </p>
            </div>
            <Switch
              id="settings-theme-toggle"
              aria-labelledby="settings-theme-label"
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </CardContent>
        </Card>

        <Card className="bg-card/92">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-xl">
              <Bell className="h-4 w-4 text-primary" />
              {t('settings.notifications')}
            </CardTitle>
            <CardDescription>{t('settings.notificationsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Leave request notification toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-2 p-4">
              <div>
                <p id="settings-leave-notif-label" className="font-semibold text-foreground">
                  {t('settings.leaveRequestNotif')}
                </p>
                <p className="text-sm text-muted-foreground">{t('settings.leaveRequestNotifDesc')}</p>
              </div>
              <Switch
                id="settings-leave-notif-toggle"
                aria-labelledby="settings-leave-notif-label"
                checked={settings.leaveRequestNotif}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, leaveRequestNotif: Boolean(checked) }))
                }
              />
            </div>

            {/* Certification notification toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-2 p-4">
              <div>
                <p id="settings-cert-notif-label" className="font-semibold text-foreground">
                  {t('settings.certificationNotif')}
                </p>
                <p className="text-sm text-muted-foreground">{t('settings.certificationNotifDesc')}</p>
              </div>
              <Switch
                id="settings-cert-notif-toggle"
                aria-labelledby="settings-cert-notif-label"
                checked={settings.certificationNotif}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, certificationNotif: Boolean(checked) }))
                }
              />
            </div>
          </CardContent>
        </Card>


        <Card className="bg-card/92">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 text-xl">
              <Globe className="h-4 w-4 text-primary" />
              {t('settings.locale')}
            </CardTitle>
            <CardDescription>{t('settings.localeDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="rounded-xl border border-border/70 bg-surface-2 p-4">
            <Label htmlFor="settings-locale" className="mb-1 block text-sm text-muted-foreground">
              {t('settings.displayLanguage')}
            </Label>
            <Select
              value={i18n.language}
              onValueChange={changeLanguage}
            >
              <SelectTrigger id="settings-locale" className="w-full max-w-xs">
                <SelectValue placeholder={t('settings.selectLocale')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t('common.english')}</SelectItem>
                <SelectItem value="fr">{t('common.french')}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-border/70 bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
          {t('settings.storageNote')}
        </div>
      </div>
    </div>
  );
};

