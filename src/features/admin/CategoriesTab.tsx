'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormAlert } from '@/components/ui/FormAlert';
import { TextField } from '@/components/ui/TextField';
import { type Dictionary } from '@/i18n';
import { apiRequest } from '@/features/auth/api';
import type { CategoryDto } from '@/server/modules/admin/categories';

interface CategoriesTabProps {
  dict: Dictionary;
  initialCategories: CategoryDto[];
}

export function CategoriesTab({ dict, initialCategories }: CategoriesTabProps) {
  const c = dict.admin.categories;
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>(initialCategories);

  const mutation = useMutation({
    mutationFn: async (cats: CategoryDto[]) => {
      return apiRequest<{ categories: CategoryDto[] }>('/api/admin/categories', {
        method: 'PUT',
        body: cats,
      });
    },
    onSuccess: (data) => {
      setCategories(data.categories);
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setNotice({ tone: 'success', text: c.savedToast });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  function move(index: number, direction: 'up' | 'down') {
    const newCategories = [...categories];
    const target = index + (direction === 'up' ? -1 : 1);
    if (target < 0 || target >= newCategories.length) return;
    const currentItem = newCategories[index];
    const targetItem = newCategories[target];
    if (!currentItem || !targetItem) return;
    newCategories[index] = targetItem;
    newCategories[target] = currentItem;
    setCategories(newCategories);
  }

  function handleNameChange(index: number, name: string) {
    setCategories((prev) => prev.map((cat, i) => (i === index ? { ...cat, name } : cat)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(categories);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{c.title}</CardTitle>
        <p className="mt-1 text-sm text-muted">{c.subtitle}</p>
      </CardHeader>
      <CardBody>
        {notice ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-2 text-sm font-medium text-ink sm:grid-cols-[1fr_60px_80px_100px]">
            <div>{c.category}</div>
            <div className="text-center">{c.guides}</div>
            <div></div>
            <div></div>
          </div>

          {categories.map((cat, index) => (
            <div key={cat.name} className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <TextField
                  id={`category-${index}`}
                  label={`${c.category} ${index + 1}`}
                  name={`category_${index}`}
                  value={cat.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                />
              </div>
              <span className="w-16 text-center text-sm text-muted">{cat.guideCount}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => move(index, 'up')}
                disabled={index === 0}
                aria-label={c.category}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => move(index, 'down')}
                disabled={index === categories.length - 1}
                aria-label={c.category}
              >
                ↓
              </Button>
            </div>
          ))}

          <div className="pt-4 border-t border-line">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? dict.common.saving : c.saveButton}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}