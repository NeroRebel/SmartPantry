import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { searchProducts } from '@/api/open-food-facts';
import type { ProductSearchResult } from '@/types/scanned-product';

type SearchState = { status: 'idle' | 'loading' | 'success' | 'error'; products: ProductSearchResult[] };

export function useProductSearch(query: string) {
  const search = query.trim();
  const [state, setState] = useState<SearchState>({ status: 'idle', products: [] });
  const [request, setRequest] = useState({ query: '', attempt: 0 });
  useFocusEffect(useCallback(() => {
    const requestedQuery = request.query === search ? request.query : search;
    if (search.length < 3) {
      setState({ status: 'idle', products: [] });
      return;
    }
    let active = true;
    const controller = new AbortController();
    setState({ status: 'loading', products: [] });
    const timer = setTimeout(() => {
      void searchProducts(requestedQuery, controller.signal).then((products) => {
        if (active) setState({ status: 'success', products });
      }).catch(() => {
        if (active && !controller.signal.aborted) setState({ status: 'error', products: [] });
      });
    }, 400);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [search, request]));
  return { ...state, retry: () => setRequest((value) => ({ query: search, attempt: value.attempt + 1 })) };
}
