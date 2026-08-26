import { useCallback, useEffect, useRef, useState } from 'react';
import { listImages } from '../services/imageService';
import { DEFAULT_PAGE_SIZE } from '../utils/constants';

/**
 * Gallery data hook: database-side filtering + pagination with infinite
 * scroll (spec §20, §22, §52). Re-runs whenever `filters` changes.
 *
 * @returns {{ items, total, loading, loadingMore, error, hasMore, loadMore, retry, isNotConfigured }}
 */
export function useImages({ filters = {}, pageSize = DEFAULT_PAGE_SIZE, publishedOnly = true }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [isNotConfigured, setIsNotConfigured] = useState(false);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const inFlightRef = useRef(false);
  const filterKey = JSON.stringify({ ...filters, publishedOnly, pageSize });

  const loadPage = useCallback(
    async (page, mode) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (mode === 'reset') setLoading(true);
      else setLoadingMore(true);

      try {
        const { items: rows, total: count } = await listImages({
          ...filters,
          page,
          pageSize,
          publishedOnly,
        });
        setItems((prev) => (page === 1 ? rows : [...prev, ...rows]));
        setTotal(count);
        hasMoreRef.current = rows.length > 0 && page * pageSize < count;
        pageRef.current = page;
        setError(null);
        setIsNotConfigured(false);
      } catch (err) {
        if (err?.isNotConfigured) {
          setIsNotConfigured(true);
        } else {
          setError(err?.message || 'Something went wrong. Please try again.');
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey],
  );

  useEffect(() => {
    setItems([]);
    hasMoreRef.current = false;
    loadPage(1, 'reset');
  }, [filterKey, loadPage]);

  const loadMore = useCallback(() => {
    if (inFlightRef.current || !hasMoreRef.current) return;
    loadPage(pageRef.current + 1, 'more');
  }, [loadPage]);

  const retry = useCallback(() => {
    loadPage(pageRef.current || 1, 'reset');
  }, [loadPage]);

  return {
    items,
    total,
    loading,
    loadingMore,
    error,
    hasMore: hasMoreRef.current,
    loadMore,
    retry,
    isNotConfigured,
  };
}
