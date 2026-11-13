'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormAlert } from '@/components/ui/FormAlert';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { type Dictionary } from '@/i18n';
import { apiRequest } from '@/features/auth/api';
import type { SettingDto } from '@/server/modules/settings/service';

interface SettingsTabProps {
  dict: Dictionary;
  initialSettings: SettingDto[];
}

export function SettingsTab({ dict, initialSettings }: SettingsTabProps) {
  const s = dict.admin.settings;
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const setting of initialSettings) {
      initial[setting.key] = setting.value;
    }
    return initial;
  });

  const mutation = useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      return apiRequest<{ settings: SettingDto[] }>('/api/admin/settings', {
        method: 'PUT',
        body: { settings },
      });
    },
    onSuccess: (data) => {
      const updated: Record<string, string> = {};
      data.settings.forEach((setting) => {
        updated[setting.key] = setting.value;
      });
      setValues(updated);
      setNotice({ tone: 'success', text: s.savedToast });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{s.title}</CardTitle>
        <p className="mt-1 text-sm text-muted">{s.subtitle}</p>
      </CardHeader>
      <CardBody>
        {notice ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {initialSettings.map((setting) => {
            const label = s.keys[setting.key as keyof typeof s.keys] ?? setting.key;
            if (setting.kind === 'enum') {
              const options = setting.options ?? [];
              return (
                <div key={setting.key}>
                  <SelectField
                    id={`setting-${setting.key}`}
                    label={label}
                    name={setting.key}
                    value={values[setting.key] ?? ''}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                  >
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {s.keys[`demo_ai_mode_${opt}` as keyof typeof s.keys] ?? opt}
                      </option>
                    ))}
                  </SelectField>
                </div>
              );
            }
            return (
              <div key={setting.key}>
                <TextField
                  id={`setting-${setting.key}`}
                  label={label}
                  name={setting.key}
                  type="number"
                  value={values[setting.key] ?? ''}
                  onChange={(e) => handleChange(setting.key, e.target.value)}
                  min={setting.min ?? undefined}
                  max={setting.max ?? undefined}
                />
              </div>
            );
          })}

          <div className="pt-4 border-t border-line">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? dict.common.saving : s.saveButton}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}