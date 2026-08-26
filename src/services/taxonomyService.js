import { supabase } from '../lib/supabase';
import { ensureConfigured } from './notConfigured';
import { slugify } from '../utils/slugify';
import { logActivity } from './activityService';

/**
 * Factory for the four taxonomy services (categories, tags, authors, albums).
 * Keeps the CRUD logic in one place (spec §73 Rule 3 — no duplicated logic).
 *
 * @param {object} cfg
 * @param {string} cfg.table       Supabase table name
 * @param {string} cfg.rpcTable    Value passed to taxonomy_list()
 * @param {string} cfg.entityName  Human label for activity logs ("Category")
 * @param {string[]} cfg.fields    Editable columns besides name
 * @param {(name:string)=>string} [cfg.makeSlug]
 */
export function createTaxonomyService(cfg) {
  const { table, rpcTable, entityName, fields = [] } = cfg;

  /** Index pages: each entry with published image count + cover (spec §4). */
  async function listWithCounts() {
    if (!supabase) ensureConfigured();
    try {
      const { data, error } = await supabase.rpc('taxonomy_list', { p_table: rpcTable });
      if (error) throw error;
      return data ?? [];
    } catch (err) {
      // If the taxonomy_list RPC doesn't exist, fall back to listing all
      // entries without counts. Better than breaking the page.
      if (err?.message?.includes('does not exist')) {
        const rows = await listAll();
        return rows.map((r) => ({ ...r, image_count: 0, cover_public_id: null }));
      }
      throw err;
    }
  }

  /** Plain list for form dropdowns (fast, no counts). */
  async function listAll() {
    if (!supabase) ensureConfigured();
    // Tags and authors don't have cover_image_id — only select columns that
    // exist on every taxonomy table, plus any extra ones listed in cfg.fields.
    const baseFields = ['id', 'name', 'slug'];
    const extraFields = fields.filter((f) => f !== 'name' && f !== 'slug' && f !== 'id');
    const selectCols = [...baseFields, ...extraFields].join(', ');
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .order('name');
    if (error) throw error;
    return data ?? [];
  }

  async function getBySlug(slug) {
    if (!supabase) ensureConfigured();
    // Use explicit column names — select('*') can cause 400 errors in newer
    // supabase-js versions (v2.109+).
    const cols = ['id', 'name', 'slug', ...fields].filter(Boolean).join(', ');
    const { data, error } = await supabase.from(table).select(cols).eq('slug', slug).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function create(input) {
    if (!supabase) ensureConfigured();
    const row = { name: input.name, slug: slugify(input.name) };
    for (const f of fields) if (input[f] !== undefined) row[f] = input[f] ?? null;

    let created = null;
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const candidate = { ...row, slug: attempt === 1 ? row.slug : `${row.slug}-${attempt}` };
      const { data, error } = await supabase.from(table).insert(candidate).select().single();
      if (!error) {
        created = data;
        break;
      }
      if (error.code !== '23505') throw error;
      if (attempt === 10) throw error;
    }
    await logActivity(`Created ${entityName}`, table, created.id, { name: created.name });
    return created;
  }

  async function update(id, input) {
    if (!supabase) ensureConfigured();
    const patch = {};
    if (input.name !== undefined) {
      patch.name = input.name;
      patch.slug = slugify(input.name);
    }
    for (const f of fields) if (input[f] !== undefined) patch[f] = input[f] ?? null;

    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    await logActivity(`Updated ${entityName}`, table, id, { name: data.name });
    return data;
  }

  async function remove(id) {
    if (!supabase) ensureConfigured();
    const { data: existing } = await supabase.from(table).select('name').eq('id', id).maybeSingle();
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    await logActivity(`Deleted ${entityName}`, table, id, existing ? { name: existing.name } : null);
  }

  return { listWithCounts, listAll, getBySlug, create, update, remove };
}
