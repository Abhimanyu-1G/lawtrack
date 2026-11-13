'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormAlert } from '@/components/ui/FormAlert';
import { Modal } from '@/components/ui/Modal';
import { SelectField } from '@/components/ui/SelectField';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/Table';
import { TextField } from '@/components/ui/TextField';
import { type Dictionary } from '@/i18n';
import { apiRequest } from '@/features/auth/api';
import type { AdminUserDto, AdminUserListDto } from '@/server/modules/admin/service';

interface UsersTabProps {
  dict: Dictionary;
  initialUsers: AdminUserListDto;
}

export function UsersTab({ dict, initialUsers }: UsersTabProps) {
  const userDict = dict.admin.users;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(initialUsers.page);
  const [pageSize] = useState(initialUsers.pageSize);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserDto | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin-users', page, pageSize, query, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query) params.set('q', query);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load users');
      return res.json() as Promise<AdminUserListDto>;
    },
    initialData: initialUsers,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string; language: string }) => {
      return apiRequest<{ user: AdminUserDto }>('/api/admin/users', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice({ tone: 'success', text: userDict.createdToast });
      setModalOpen(false);
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; role: string; language: string }) => {
      return apiRequest<{ user: AdminUserDto }>(`/api/admin/users/${data.id}`, {
        method: 'PATCH',
        body: { name: data.name, role: data.role, language: data.language },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setNotice({ tone: 'success', text: userDict.updatedToast });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const roles = ['Lawyer', 'Curator', 'Administrator', 'API Manager'] as const;
  const languages = ['English', 'Hindi'] as const;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(user: AdminUserDto) {
    setEditing(user);
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get('name') as string,
      email: form.get('email') as string,
      role: form.get('role') as string,
      language: form.get('language') as string,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: data.name, role: data.role, language: data.language });
    } else {
      createMutation.mutate(data);
    }
  }

  const totalPages = Math.max(1, Math.ceil((usersQuery.data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle as="h2">{userDict.title}</CardTitle>
            <Button onClick={openCreate}>{userDict.createButton}</Button>
          </div>
          <p className="mt-1 text-sm text-muted">{userDict.subtitle}</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-64">
              <TextField
                id="admin-users-search"
                label={userDict.name}
                name="q"
                placeholder={userDict.name}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="w-56">
              <SelectField
                id="admin-users-role-filter"
                label={userDict.role}
                name="role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">{userDict.role}</option>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {userDict.roleOptions[r]}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {notice ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null}

          <Table caption={userDict.title}>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{userDict.name}</TableHeaderCell>
                <TableHeaderCell>{userDict.email}</TableHeaderCell>
                <TableHeaderCell>{userDict.role}</TableHeaderCell>
                <TableHeaderCell>{userDict.language}</TableHeaderCell>
                <TableHeaderCell>{userDict.actions}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersQuery.data?.users.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{row.email}</span>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">
                      {userDict.roleOptions[row.role as keyof typeof userDict.roleOptions] ?? row.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{row.language}</span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                      {userDict.edit}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!usersQuery.data?.users.length) && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted">
                    {userDict.noResults}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                ←
              </Button>
              <span className="text-sm text-muted">{userDict.page.replace('{{page}}', String(page)).replace('{{total}}', String(totalPages))}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                →
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? dict.admin.users.edit : userDict.createButton}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            id="user-modal-name"
            name="name"
            label={userDict.name}
            required
            defaultValue={editing?.name}
            disabled={!!editing}
          />
          {!editing && (
            <TextField
              id="user-modal-email"
              name="email"
              label={userDict.email}
              type="email"
              required
            />
          )}
          <SelectField
            id="user-modal-role"
            name="role"
            label={userDict.role}
            required
            defaultValue={editing?.role ?? 'Lawyer'}
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {userDict.roleOptions[r]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="user-modal-language"
            name="language"
            label={userDict.language}
            required
            defaultValue={editing?.language ?? 'English'}
          >
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setModalOpen(false); setEditing(null); }}>
              {dict.common.cancel}
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? dict.common.saving : dict.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}