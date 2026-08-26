import { supabase } from '../lib/supabase';
import { ensureConfigured, NotConfiguredError } from './notConfigured';
import { slugify } from '../utils/slugify';
import { DEFAULT_PAGE_SIZE } from '../utils/constants';
import { deleteCloudinaryAsset } from './cloudinaryService';
import { logActivity } from './activityService';

const IMAGE_LIST_RPC = 'list_images';

/**
 * Database-side search + filters + sort + pagination via the list_images RPC
 * (spec §20, §22, §53 — nothing is filtered in the browser).
 */
export async function listImages({
  q = '',
  category = '',
  tag = '',
  author = '',
  album = '',
  featured = '',
  status = '',
  dateFrom = '',
  dateTo = '',
  sort = 'newest',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  publishedOnly = true,
} = {}) {
  if (!supabase) ensureConfigured();

  const { data, error } = await supabase.rpc(IMAGE_LIST_RPC, {
    p_opts: {
      q,
      category,
      tag,
      author,
      album,
      featured,
      status,
      date_from: dateFrom,
      date_to: dateTo,
      sort,
      page,
      page_size: pageSize,
      published_only: publishedOnly,
    },
  });

  if (error) throw error;
  const items = Array.isArray(data) ? data : [];
  return { items, total: Number(items[0]?.total ?? 0) };
}

export async function getImageBySlug(slug) {
  if (!supabase) ensureConfigured();
  const { data, error } = await supabase.rpc('get_image_by_slug', { p_slug: slug });
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

/** Admin: fetch a single image by id with its tag ids (RLS permits admins). */
export async function getImageById(id) {
  if (!supabase) ensureConfigured();
  const { data, error } = await supabase
    .from('images')
    .select('*, tags:image_tags(tag_id)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    tagIds: (data.tags || []).map((t) => t.tag_id),
    category: data.category_id ? { id: data.category_id } : null,
  };
}

/** Related images: same category first, otherwise sharing a tag (spec §4). */
export async function getRelatedImages(image, { limit = 8 } = {}) {
  if (!image) return [];
  const { items: byCategory } = await listImages({
    category: image.category?.slug || '',
    sort: 'newest',
    pageSize: limit + 1,
  });
  const withoutSelf = byCategory.filter((i) => i.id !== image.id);
  if (withoutSelf.length >= limit) return withoutSelf.slice(0, limit);

  const tagSlug = image.tags?.[0]?.slug || '';
  if (tagSlug) {
    const { items: byTag } = await listImages({ tag: tagSlug, sort: 'newest', pageSize: limit + 1 });
    const rest = byTag.filter((i) => i.id !== image.id && !withoutSelf.some((x) => x.id === i.id));
    return [...withoutSelf, ...rest].slice(0, limit);
  }
  return withoutSelf.slice(0, limit);
}

/** Prev/next navigation within the same filtered set. */
export async function getAdjacentImages(image, filters = {}) {
  if (!image) return { prev: null, next: null };
  const { items } = await listImages({
    ...filters,
    q: filters.q || '',
    sort: filters.sort || 'newest',
    pageSize: 100,
  });
  const idx = items.findIndex((i) => i.id === image.id);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx < items.length - 1 ? items[idx + 1] : null,
  };
}

export async function getFeaturedImages(limit = 6) {
  const { items } = await listImages({ featured: 'true', sort: 'newest', pageSize: limit });
  return items;
}

export async function getLatestImages(limit = 12) {
  const { items } = await listImages({ sort: 'newest', pageSize: limit });
  return items;
}

export async function getMostViewedImages(limit = 6) {
  const { items } = await listImages({ sort: 'most_viewed', pageSize: limit });
  return items;
}

/** One view per session per image (spec §23). */
export async function recordImageView(imageId) {
  if (!supabase) return;
  let sessionKey = localStorage.getItem('gallery_session_id');
  if (!sessionKey) {
    sessionKey = crypto.randomUUID();
    localStorage.setItem('gallery_session_id', sessionKey);
  }
  await supabase.rpc('record_image_view', {
    p_image_id: imageId,
    p_session_key: sessionKey,
  });
}

// ---------------------------------------------------------------------------
// Admin CRUD (authorization enforced by RLS — admin-only policies)
// ---------------------------------------------------------------------------

function retryUniqueSlug(payload, attempt) {
  const suffix = attempt === 1 ? '' : `-${attempt}`;
  return { ...payload, slug: `${slugify(payload.slug || payload.title)}${suffix}` };
}

export async function createImage({ tags = [], ...payload }) {
  if (!supabase) ensureConfigured();
  const base = {
    title: payload.title,
    slug: slugify(payload.title),
    description: payload.description || null,
    caption: payload.caption || null,
    alt_text: payload.alt_text || null,
    cloudinary_public_id: payload.cloudinary_public_id,
    cloudinary_url: payload.cloudinary_url || null,
    secure_url: payload.secure_url,
    thumbnail_url: payload.thumbnail_url || null,
    width: payload.width || null,
    height: payload.height || null,
    format: payload.format || null,
    file_size: payload.file_size || null,
    category_id: payload.category_id || null,
    author_id: payload.author_id || null,
    album_id: payload.album_id || null,
    sort_order: payload.sort_order ?? 0,
    is_featured: Boolean(payload.is_featured),
    is_published: Boolean(payload.is_published),
    allow_download: Boolean(payload.allow_download),
    published_at: payload.is_published ? new Date().toISOString() : null,
  };

  let created = null;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const { data, error } = await supabase
      .from('images')
      .insert(retryUniqueSlug(base, attempt))
      .select('id')
      .single();
    if (!error) {
      created = data;
      break;
    }
    if (error.code !== '23505') throw error; // 23505 = unique_violation
    if (attempt === 10) throw error;
  }

  await replaceImageTags(created.id, tags);
  await logActivity('Uploaded image', 'image', created.id, { title: payload.title });
  return created;
}

export async function updateImage(id, { tags, ...payload }) {
  if (!supabase) ensureConfigured();
  const patch = {};
  const map = {
    title: 'title',
    description: 'description',
    caption: 'caption',
    alt_text: 'alt_text',
    cloudinary_public_id: 'cloudinary_public_id',
    cloudinary_url: 'cloudinary_url',
    secure_url: 'secure_url',
    thumbnail_url: 'thumbnail_url',
    width: 'width',
    height: 'height',
    format: 'format',
    file_size: 'file_size',
    category_id: 'category_id',
    author_id: 'author_id',
    album_id: 'album_id',
    sort_order: 'sort_order',
    is_featured: 'is_featured',
    is_published: 'is_published',
    allow_download: 'allow_download',
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in payload) patch[col] = payload[key];
  }
  if ('title' in patch) patch.slug = slugify(patch.title);

  const { data, error } = await supabase.from('images').update(patch).eq('id', id).select().single();
  if (error) throw error;

  if (tags) await replaceImageTags(id, tags);

  // Keep published_at meaningful: set when first published, keep when re-published.
  if (patch.is_published !== undefined && data.published_at === null && patch.is_published) {
    await supabase.from('images').update({ published_at: new Date().toISOString() }).eq('id', id);
  }

  await logActivity('Updated image', 'image', id, { title: data.title });
  return data;
}

export async function setImageFeatured(id, isFeatured) {
  if (!supabase) ensureConfigured();
  const { error } = await supabase.from('images').update({ is_featured: isFeatured }).eq('id', id);
  if (error) throw error;
}

export async function setImagePublished(id, isPublished) {
  if (!supabase) ensureConfigured();
  const { error } = await supabase
    .from('images')
    .update({ is_published: isPublished, published_at: isPublished ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

/** Bulk ops (spec §25). */
export async function bulkUpdateImages(ids, patch) {
  if (!supabase || !ids.length) return;
  const clean = {};
  if ('is_published' in patch) {
    clean.is_published = patch.is_published;
    clean.published_at = patch.is_published ? new Date().toISOString() : null;
  }
  if ('is_featured' in patch) clean.is_featured = patch.is_featured;
  if ('category_id' in patch) clean.category_id = patch.category_id || null;
  if ('album_id' in patch) clean.album_id = patch.album_id || null;
  const { error } = await supabase.from('images').update(clean).in('id', ids);
  if (error) throw error;
}

export async function bulkAddTags(ids, tagIds) {
  if (!supabase) return;
  const rows = [];
  for (const imageId of ids) {
    for (const tagId of tagIds) rows.push({ image_id: imageId, tag_id: tagId });
  }
  const { error } = await supabase.from('image_tags').upsert(rows, { onConflict: 'image_id,tag_id' });
  if (error) throw error;
}

export async function bulkRemoveTags(ids, tagIds) {
  if (!supabase) return;
  const { error } = await supabase
    .from('image_tags')
    .delete()
    .in('image_id', ids)
    .in('tag_id', tagIds);
  if (error) throw error;
}

async function replaceImageTags(imageId, tagIds = []) {
  if (!supabase) return;
  const { error: del } = await supabase.from('image_tags').delete().eq('image_id', imageId);
  if (del) throw del;
  if (tagIds.length) {
    const rows = tagIds.map((tagId) => ({ image_id: imageId, tag_id: tagId }));
    const { error: ins } = await supabase.from('image_tags').insert(rows);
    if (ins) throw ins;
  }
}

/**
 * Delete an image: DB row first (image_tags cascade), then the Cloudinary
 * asset. If the CDN delete fails we report it so the UI can offer a retry —
 * we never pretend the deletion succeeded (spec §28).
 */
export async function deleteImage(id) {
  if (!supabase) ensureConfigured();

  const { data: existing } = await supabase
    .from('images')
    .select('id, title, cloudinary_public_id')
    .eq('id', id)
    .maybeSingle();
  const publicId = existing?.cloudinary_public_id;

  const { error: del } = await supabase.from('images').delete().eq('id', id);
  if (del) throw del;

  await logActivity('Deleted image', 'image', id, existing ? { title: existing.title } : null);

  if (!publicId) return { ok: true, cloudinary: null };
  try {
    const result = await deleteCloudinaryAsset(publicId);
    return { ok: true, cloudinary: result };
  } catch (err) {
    return {
      ok: false,
      cloudinary: null,
      cloudinaryError: err.message || 'Failed to delete from CDN.',
    };
  }
}

export async function getDashboardStats() {
  if (!supabase) ensureConfigured();
  const { data, error } = await supabase.rpc('dashboard_stats');
  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

export async function getRecentActivity(limit = 10) {
  if (!supabase) ensureConfigured();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export { NotConfiguredError };
