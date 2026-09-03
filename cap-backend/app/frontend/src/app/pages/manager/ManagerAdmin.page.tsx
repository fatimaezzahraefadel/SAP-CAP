import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle, Edit, Eye, EyeOff, Plus, RefreshCw, Search, Shield, Trash2, Users, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { UsersAPI } from '../../services/odata/usersApi';
import { User } from '../../types/entities';

// Génère un mot de passe lisible à partir de l'email
const generatePassword = (email: string): string => {
  const local = email.split('@')[0] ?? 'user';
  const clean = local.replace(/[^a-zA-Z0-9]/g, '');
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}@Inetum2026`;
};

interface ConsultantForm {
  name: string;
  email: string;
  availabilityPercent: number;
  active: boolean;
}

const EMPTY_FORM: ConsultantForm = {
  name: '',
  email: '',
  availabilityPercent: 80,
  active: true,
};

export function ManagerAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConsultantForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const all = await UsersAPI.getAll();
      setUsers(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const consultants = useMemo(() =>
    users.filter((u) => u.role === 'CONSULTANT_TECHNIQUE'),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return consultants.filter((u) =>
      !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [consultants, search]);

  const stats = useMemo(() => ({
    total: consultants.length,
    active: consultants.filter((u) => u.active).length,
    inactive: consultants.filter((u) => !u.active).length,
  }), [consultants]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      availabilityPercent: user.availabilityPercent,
      active: user.active,
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Le nom et l\'email sont requis');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Email invalide');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await UsersAPI.update(editingId, {
          name: form.name.trim(),
          availabilityPercent: form.availabilityPercent,
        });
        setUsers((prev) => prev.map((u) => u.id === editingId ? updated : u));
        toast.success('Consultant mis à jour');
      } else {
        // Créer via API
        const newUser = await UsersAPI.create({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: 'CONSULTANT_TECHNIQUE',
          active: form.active,
          availabilityPercent: form.availabilityPercent,
          skills: [],
          certifications: [],
        });
        setUsers((prev) => [...prev, newUser]);
        toast.success(`Consultant créé — Mot de passe : ${generatePassword(form.email)}`);
      }
      closeDialog();
    } catch {
      toast.error('Échec de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      const updated = await UsersAPI.update(user.id, { active: !user.active });
      setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u));
      toast.success(user.active ? 'Compte désactivé' : 'Compte activé');
    } catch {
      toast.error('Échec de la mise à jour');
    }
  };

  const deleteUser = async (user: User) => {
    try {
      await UsersAPI.delete(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success('Consultant supprimé');
    } catch {
      toast.error('Impossible de supprimer ce consultant');
    } finally {
      setPendingDelete(null);
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Administration"
        subtitle="Gestion des comptes consultants techniques de l'équipe"
        breadcrumbs={[{ label: 'Manager', path: '/manager/leave' }, { label: 'Administration' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau consultant
            </Button>
          </div>
        }
      />

      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* KPI */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total consultants</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actifs</p>
                <p className="text-2xl font-semibold text-primary">{stats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactifs</p>
                <p className="text-2xl font-semibold text-destructive">{stats.inactive}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Info accès */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-primary">
              <Shield className="h-4 w-4" />
              Accès à la plateforme
            </CardTitle>
            <CardDescription>
              Pour se connecter, chaque consultant utilise son email comme identifiant.
              Le mot de passe est généré automatiquement à la création.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Tableau */}
        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Consultants techniques</CardTitle>
                <CardDescription>Liste des consultants avec leurs accès</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Consultant</TableHead>
                  <TableHead className="px-4">Email / Identifiant</TableHead>
                  <TableHead className="px-4">Mot de passe</TableHead>
                  <TableHead className="px-4">Disponibilité</TableHead>
                  <TableHead className="px-4">Statut</TableHead>
                  <TableHead className="px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j} className="px-4">
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Aucun consultant trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => {
                    const password = generatePassword(user.email);
                    const showPwd = visiblePasswords.has(user.id);
                    return (
                      <TableRow key={user.id} className={!user.active ? 'opacity-60' : undefined}>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {user.name.charAt(0)}
                            </div>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {showPwd ? password : '••••••••••••'}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(user.id)}
                            >
                              {showPwd
                                ? <EyeOff className="h-3.5 w-3.5" />
                                : <Eye className="h-3.5 w-3.5" />
                              }
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="w-32 space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Disponibilité</span>
                              <span>{user.availabilityPercent}%</span>
                            </div>
                            <Progress value={user.availabilityPercent} />
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge
                            variant={user.active ? 'default' : 'secondary'}
                            className="gap-1 cursor-pointer"
                            onClick={() => void toggleActive(user)}
                          >
                            {user.active
                              ? <><CheckCircle className="h-3 w-3" /> Actif</>
                              : <><XCircle className="h-3 w-3" /> Inactif</>
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(user)}
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDelete(user)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Dialog créer/modifier */}
      <Dialog open={showDialog} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le consultant' : 'Nouveau consultant technique'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifiez les informations du consultant.'
                : 'Créez un nouveau compte consultant. Le mot de passe sera généré automatiquement.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void save(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="form-name">Nom complet *</Label>
              <Input
                id="form-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="ex. Fatima-Ezzahrae FADEL"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-email">Email *</Label>
              <Input
                id="form-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="prenom.nom@inetum.com"
                disabled={!!editingId}
                required
              />
              {!editingId && form.email && (
                <p className="text-xs text-muted-foreground">
                  Mot de passe généré : <span className="font-mono font-medium text-primary">{generatePassword(form.email)}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-availability">Disponibilité (%)</Label>
              <Input
                id="form-availability"
                type="number"
                min={0}
                max={100}
                value={form.availabilityPercent}
                onChange={(e) => setForm((p) => ({ ...p, availabilityPercent: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select
                value={form.active ? 'active' : 'inactive'}
                onValueChange={(v) => setForm((p) => ({ ...p, active: v === 'active' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le consultant</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer définitivement "{pendingDelete?.name}" ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && void deleteUser(pendingDelete)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
