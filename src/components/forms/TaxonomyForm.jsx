import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal';
import { Field, Input, Textarea } from '../ui/Field';
import { Button } from '../ui/Button';
import { useToast } from '../../contexts/ToastContext';

/**
 * Generic create/edit modal for categories, tags, authors and albums
 * (spec §29–§32). One component, no duplicated forms.
 */
export function TaxonomyForm({ open, onClose, onSaved, service, schema, entityLabel, editItem }) {
  const toast = useToast();
  const isEdit = Boolean(editItem);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset(
        editItem
          ? {
              name: editItem.name,
              description: editItem.description || '',
              bio: editItem.bio || '',
              website_url: editItem.website_url || '',
              avatar_url: editItem.avatar_url || '',
            }
          : { name: '', description: '', bio: '', website_url: '', avatar_url: '' },
      );
    }
  }, [open, editItem, reset]);

  async function onSubmit(values) {
    try {
      if (isEdit) {
        await service.update(editItem.id, values);
        toast.success(`${entityLabel} updated.`);
      } else {
        await service.create(values);
        toast.success(`${entityLabel} created.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.message === 'Database error saving changes' ? 'Could not save. Check for duplicate names.' : 'Something went wrong. Please try again.');
    }
  }

  const showDescription = ['categories', 'albums'].includes(service.table);
  const showBio = service.table === 'authors';
  const showWebsite = service.table === 'authors';
  const showAvatar = service.table === 'authors';

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit ${entityLabel}` : `New ${entityLabel}`} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="tax-name" required error={errors.name?.message}>
          <Input id="tax-name" placeholder={entityLabel} {...register('name')} invalid={!!errors.name} />
        </Field>

        {showDescription && (
          <Field label="Description" htmlFor="tax-desc" error={errors.description?.message}>
            <Textarea id="tax-desc" rows={3} placeholder="Optional short description…" {...register('description')} />
          </Field>
        )}

        {showBio && (
          <Field label="Bio" htmlFor="tax-bio" error={errors.bio?.message}>
            <Textarea id="tax-bio" rows={3} placeholder="About this author…" {...register('bio')} />
          </Field>
        )}

        {showWebsite && (
          <Field label="Website URL" htmlFor="tax-site" error={errors.website_url?.message}>
            <Input id="tax-site" type="url" placeholder="https://…" {...register('website_url')} />
          </Field>
        )}

        {showAvatar && (
          <Field label="Avatar URL" htmlFor="tax-avatar" error={errors.avatar_url?.message}>
            <Input id="tax-avatar" type="url" placeholder="https://… (Cloudinary or external)" {...register('avatar_url')} />
          </Field>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
