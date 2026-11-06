import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { Product, StoreStatus, Review, Feedback, GalleryImage } from './types';
import { DEFAULT_GALLERY_IMAGES } from './galleryData';
import {
  sendFeedbackToGoogleSheet,
  fetchFeedbackFromGoogleSheet,
  fetchGlobalStateFromGoogleSheet,
  saveGlobalStateToGoogleSheet,
} from './googleSheets';
import { calculateStoreStatus } from './constants';
import { withDedupe, invalidateCache } from './requestCache';
import { idbGet, idbSet, idbDelete } from './mediaStorage';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'a02c1b34-590f-4b78-ac49-bfced2c00683',
    slug: 'kachori',
    name: 'Regular Kachori',
    price: 40,
    description:
      'Crispy, golden-fried puffed pastry stuffed with our classic spiced lentil and onion filling — served fresh with tangy house chutneys.',
    image_url: '/images/kachori.webp',
    available: true,
    stock: 80,
    featured: true,
    display_order: 1,
  },
  {
    id: 'f2203570-d34c-42b6-a32f-8283bd4bd386',
    slug: 'kachori-jain',
    name: 'Jain Kachori (No Onion / No Garlic)',
    price: 40,
    description:
      'Prepared strictly per Jain dietary traditions without onion or garlic — packed with rich authentic spices and served with fresh sweet and spicy chutneys.',
    image_url: '/images/kachori.webp',
    available: true,
    stock: 50,
    featured: false,
    display_order: 2,
  },
  {
    id: '64032dd9-f7bd-4944-9939-4ba938b6cd43',
    slug: 'kachori-swaminarayan',
    name: 'Swaminarayan Kachori (Satvik)',
    price: 40,
    description:
      'Pure satvik preparation crafted strictly without onion or garlic, following Swaminarayan dietary guidelines with fragrant spices and fresh chutneys.',
    image_url: '/images/kachori.webp',
    available: true,
    stock: 50,
    featured: false,
    display_order: 3,
  },
  {
    id: 'c03f00f9-646c-4727-9f25-9456bbff9531',
    slug: 'bhel',
    name: 'Fresh Bhel',
    price: 45,
    description:
      'Light, crunchy puffed rice tossed with fresh tomatoes, onions, sev and our house chutneys — a burst of flavour in every bite.',
    image_url: '/images/bhel.webp',
    available: true,
    stock: 60,
    featured: false,
    display_order: 4,
  },
  {
    id: '52f0f8d7-403b-491e-bc93-ea34c63871d5',
    slug: 'crash-kachori',
    name: 'crash kachori',
    price: 60,
    description: 'Special crash kachori with crunchy toppings and rich chutneys.',
    image_url: '/images/kachori.webp',
    available: true,
    stock: 50,
    featured: false,
    display_order: 5,
  },
];

const INITIAL_PINNED_REVIEWS: Review[] = [
  {
    id: 'jd-001',
    rating: 5,
    customer_name: 'Ramesh Prajapati',
    message:
      'Paras Kachoriwala has been my family go-to for years. The Regular Kachori is always crispy on the outside and perfectly stuffed inside — Jain Kachori is equally authentic without onion-garlic. Fresh chutneys make every bite special.',
    created_at: '2025-06-14T18:30:00.000Z',
    display_order: 1,
    source: 'justdial',
  },
  {
    id: 'jd-002',
    rating: 5,
    customer_name: 'Kinjal Shah',
    message:
      'I live nearby and visit almost every evening. The Swaminarayan Kachori is satvik, tasty and strictly prepared the way we prefer. Their Bhel is light, crunchy and never oily. Best part — reasonable prices and large, jumbo-sized portions.',
    created_at: '2025-07-02T19:05:00.000Z',
    display_order: 2,
    source: 'justdial',
  },
  {
    id: 'jd-003',
    rating: 4,
    customer_name: 'Haresh Patel',
    message:
      'Took my family of 6 last week. The counter token system is smooth — no confusion at all. Kachori was fresh and filling. Sometimes the evening rush can be busy but wait is worthwhile. Recommended for authentic street-style kachori.',
    created_at: '2025-05-21T20:12:00.000Z',
    display_order: 3,
    source: 'justdial',
  },
  {
    id: 'jd-004',
    rating: 5,
    customer_name: 'Daxa Ben Mehta',
    message:
      'We order almost every weekend for the entire joint family. Kids love the Bhel and elders enjoy the Jain Kachori. The taste has been consistent for as long as I remember. Paras ji ke kachori mein woh baat hai!',
    created_at: '2025-08-09T19:20:00.000Z',
    display_order: 4,
    source: 'justdial',
  },
  {
    id: 'jd-005',
    rating: 5,
    customer_name: 'Vivek Trivedi',
    message:
      'As someone who has tried kachori shops across the city, Paras Kachoriwala stands out for freshness. Every piece is puffed, the filling is generous, and the chutneys are balanced — not too sweet, not too tangy. Pure 5 stars from a regular customer.',
    created_at: '2025-04-30T19:45:00.000Z',
    display_order: 5,
    source: 'justdial',
  },
  {
    id: 'jd-006',
    rating: 4,
    customer_name: 'Bharat Desai',
    message:
      'Genuine local kachori place. Cash only, token system, very orderly service. Portions are big — one jumbo kachori with Bhel is enough for two adults. My friends from Mumbai were really impressed when I took them here last month.',
    created_at: '2025-07-27T20:30:00.000Z',
    display_order: 6,
    source: 'justdial',
  },
];

const DEFAULT_STORE_STATUS: StoreStatus = {
  id: 'store_status_main',
  is_open: true,
  crowd_level: 'Moderate',
  last_updated: new Date().toISOString(),
  closed_for_date: null,
  force_open_date: null,
};

const STORAGE_STATUS_KEY = 'pk_local_store_status_v3';
const STORAGE_PRODUCTS_KEY = 'pk_local_products_v5';
const STORAGE_DELETED_PRODUCTS_KEY = 'pk_deleted_products_v5';
const STORAGE_GALLERY_KEY = 'pk_gallery_synced_v10';
const STORAGE_DELETED_GALLERY_KEY = 'pk_deleted_gallery_v10';
const STORAGE_FEEDBACK_KEY = 'pk_all_feedback_records_v3';
const STORAGE_DELETED_REVIEWS_KEY = 'pk_deleted_review_ids_v4';
const STORAGE_FEATURED_REVIEWS_KEY = 'pk_featured_review_ids_v4';
const STORAGE_UNFEATURED_REVIEWS_KEY = 'pk_unfeatured_review_ids_v4';
// IDs of reviews that have been confirmed present in the Supabase `feedback`
// table by at least one successful read. Used to detect reviews that were
// deleted remotely (present before, missing now) so the cached copy on this
// device can never resurrect them.
const STORAGE_REMOTE_REVIEWS_KEY = 'pk_remote_review_ids_v1';

// Actively purge all legacy cache keys from earlier app builds across all customer & admin devices
const LEGACY_STORAGE_KEYS = [
  'pk_local_products',
  'pk_local_products_v1',
  'pk_local_products_v2',
  'pk_local_products_v3',
  'pk_local_products_v4',
  'pk_deleted_products_v4',
  'pk_local_gallery',
  'pk_local_gallery_v2',
  'pk_local_gallery_v3',
  'pk_local_gallery_v4',
  'pk_gallery_master_v5',
  'pk_gallery_master_v6',
  'pk_gallery_synced_v7',
  'pk_gallery_synced_v8',
  'pk_deleted_gallery_v8',
  'pk_gallery_synced_v9',
  'pk_deleted_gallery_v9',
  'pk_deleted_gallery_ids_v1',
  'pk_deleted_gallery_ids_v2',
  'pk_deleted_gallery_ids_v3',
  'pk_deleted_gallery_ids_v4',
];

if (typeof window !== 'undefined') {
  try {
    LEGACY_STORAGE_KEYS.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
      void idbDelete(k);
    });
  } catch {
    /* ignore */
  }
}

const CACHE_TTL_SHORT = 4_000;
const REQUEST_TIMEOUT_MS = 8_000;

// Cross-tab Real-Time Broadcast Channel
let syncBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncBroadcastChannel = new BroadcastChannel('paras_kachoriwala_sync');
  }
} catch {
  syncBroadcastChannel = null;
}

export function broadcastRealtimeEvent(type: string, data?: unknown) {
  try {
    syncBroadcastChannel?.postMessage({ type, data, timestamp: Date.now() });
  } catch {
    /* ignore */
  }
}

function toErrMsg(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message || fallback;
  }
  return fallback;
}

function getLocalStatus(): StoreStatus | null {
  try {
    const raw = localStorage.getItem(STORAGE_STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Track when author in this browser tab performed a store status update
let lastLocalStoreStatusEditTimestamp = 0;

/**
 * Universal RFC4122 v4 UUID generator that functions identically
 * across secure HTTPS, local HTTP, and mobile browsers.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* ignore and fall back */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let memoryProducts: Product[] | null = null;
let memoryGallery: GalleryImage[] | null = null;

// Guards against duplicate/parallel delete requests for the same gallery item
// (e.g. a double-click) which could otherwise race each other.
const galleryDeletionsInFlight = new Set<string>();

export function getDeletedProductSlugs(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_PRODUCTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markProductDeleted(idOrSlug: string): void {
  if (!idOrSlug) return;
  try {
    const deleted = getDeletedProductSlugs();
    deleted.add(idOrSlug);
    localStorage.setItem(STORAGE_DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(deleted)));
  } catch {
    /* ignore */
  }
}

export function unmarkProductDeleted(idOrSlug: string): void {
  if (!idOrSlug) return;
  try {
    const deleted = getDeletedProductSlugs();
    if (deleted.has(idOrSlug)) {
      deleted.delete(idOrSlug);
      localStorage.setItem(STORAGE_DELETED_PRODUCTS_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch {
    /* ignore */
  }
}

function getLocalProducts(): Product[] | null {
  if (memoryProducts && memoryProducts.length > 0) return memoryProducts;
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS_KEY);
    if (raw) {
      memoryProducts = JSON.parse(raw);
      return memoryProducts;
    }
  } catch {
    /* ignore */
  }
  return memoryProducts;
}

export function normalizeGalleryItem(img: GalleryImage): GalleryImage {
  let cat = img.category;
  if ((cat as string) === 'shop' || (cat as string) === 'home' || (cat as string) === 'about') {
    cat = 'stall';
  }
  let src = img.src || '';
  if (src.startsWith('./images/')) {
    src = src.replace('./images/', '/images/');
  } else if (src.startsWith('images/')) {
    src = '/' + src;
  }
  let mediaType = img.media_type;
  if (!mediaType) {
    const srcLower = src.toLowerCase();
    if (srcLower.endsWith('.mp4') || srcLower.endsWith('.webm') || srcLower.startsWith('data:video/')) {
      mediaType = 'video';
    } else if (
      srcLower.endsWith('.mp3') ||
      srcLower.endsWith('.wav') ||
      srcLower.endsWith('.ogg') ||
      srcLower.startsWith('data:audio/')
    ) {
      mediaType = 'audio';
    } else {
      mediaType = 'image';
    }
  }
  if (mediaType === 'video' || mediaType === 'audio') {
    if (cat !== 'customers' && cat !== 'stall' && cat !== 'food') {
      cat = 'videos';
    }
  }
  return { ...img, src, category: cat, media_type: mediaType };
}

function getLocalGallery(): GalleryImage[] | null {
  if (memoryGallery !== null) return memoryGallery;
  try {
    const raw = localStorage.getItem(STORAGE_GALLERY_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryGallery = parsed.map(normalizeGalleryItem);
        return memoryGallery;
      }
    }
  } catch {
    /* ignore */
  }
  return memoryGallery;
}

function getLocalFeedbackList(): Feedback[] {
  try {
    const raw = localStorage.getItem(STORAGE_FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFeedbackList(list: Feedback[]): void {
  try {
    localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getFeaturedReviewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_FEATURED_REVIEWS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function getUnfeaturedReviewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_UNFEATURED_REVIEWS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markReviewFeatured(id: string): void {
  try {
    const featured = getFeaturedReviewIds();
    const unfeatured = getUnfeaturedReviewIds();
    featured.add(id);
    unfeatured.delete(id);
    localStorage.setItem(STORAGE_FEATURED_REVIEWS_KEY, JSON.stringify(Array.from(featured)));
    localStorage.setItem(STORAGE_UNFEATURED_REVIEWS_KEY, JSON.stringify(Array.from(unfeatured)));
  } catch {
    /* ignore */
  }
}

export function markReviewUnfeatured(id: string): void {
  try {
    const featured = getFeaturedReviewIds();
    const unfeatured = getUnfeaturedReviewIds();
    featured.delete(id);
    unfeatured.add(id);
    localStorage.setItem(STORAGE_FEATURED_REVIEWS_KEY, JSON.stringify(Array.from(featured)));
    localStorage.setItem(STORAGE_UNFEATURED_REVIEWS_KEY, JSON.stringify(Array.from(unfeatured)));
  } catch {
    /* ignore */
  }
}

export function getDeletedReviewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_REVIEWS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markReviewDeleted(id: string): void {
  try {
    const deleted = getDeletedReviewIds();
    const featured = getFeaturedReviewIds();
    const unfeatured = getUnfeaturedReviewIds();
    deleted.add(id);
    featured.delete(id);
    unfeatured.delete(id);
    localStorage.setItem(STORAGE_DELETED_REVIEWS_KEY, JSON.stringify(Array.from(deleted)));
    localStorage.setItem(STORAGE_FEATURED_REVIEWS_KEY, JSON.stringify(Array.from(featured)));
    localStorage.setItem(STORAGE_UNFEATURED_REVIEWS_KEY, JSON.stringify(Array.from(unfeatured)));
  } catch {
    /* ignore */
  }
}

function getKnownRemoteReviewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_REMOTE_REVIEWS_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

const REVIEW_ID_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A locally cached review is only treated as remotely deleted once it is old
// enough that its own database insert must already have completed. This keeps
// an in-flight submission from being mistaken for a deletion.
const REMOTE_DELETE_GRACE_MS = 2 * 60 * 1000;

/**
 * Supabase is the single source of truth for customer reviews.
 *
 * A review that is still cached locally but is missing from a *successful*
 * remote read was deleted — either from this device or from another admin on
 * another device. Such IDs are tombstoned locally so the cached copy, the
 * Google Sheets mirror, or a stale local list can never resurrect them.
 *
 * Local rows that were never persisted remotely (non-UUID ids, or rows too
 * new to have completed their insert) are left untouched.
 *
 * Must only be called after a successful remote read (i.e. `data` is an
 * array), otherwise a network failure would look like "everything deleted".
 *
 * @param remoteIds IDs returned by the latest successful Supabase read.
 * @returns number of remotely-deleted reviews that were tombstoned.
 */
export function reconcileRemoteReviewIds(remoteIds: Iterable<string>): number {
  try {
    const remote = new Set<string>(remoteIds);
    const now = Date.now();

    const known = getKnownRemoteReviewIds();
    const deletedRemotely = new Set<string>();

    // 1. Reviews previously confirmed present in Supabase and now missing.
    known.forEach((id) => {
      if (!remote.has(id)) deletedRemotely.add(id);
    });

    // 2. Reviews still held in the local cache (or the Sheets mirror) with a
    //    real database id but absent from the authoritative remote list.
    getLocalFeedbackList().forEach((row) => {
      if (!row || !row.id || remote.has(row.id)) return;
      if (!REVIEW_ID_UUID_PATTERN.test(row.id)) return;
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;
      if (!Number.isFinite(createdAt) || now - createdAt < REMOTE_DELETE_GRACE_MS) return;
      deletedRemotely.add(row.id);
    });

    if (deletedRemotely.size === 0) {
      // Refresh the ledger so reviews that just synced are remembered.
      const next = new Set(known);
      remote.forEach((id) => next.add(id));
      try {
        localStorage.setItem(STORAGE_REMOTE_REVIEWS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return 0;
    }

    deletedRemotely.forEach((id) => markReviewDeleted(id));

    const next = new Set(known);
    remote.forEach((id) => next.add(id));
    deletedRemotely.forEach((id) => next.delete(id));
    try {
      localStorage.setItem(STORAGE_REMOTE_REVIEWS_KEY, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }

    return deletedRemotely.size;
  } catch {
    return 0;
  }
}

export function getDeletedGalleryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_GALLERY_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markGalleryImageDeleted(id: string): void {
  if (!id) return;
  try {
    const deleted = getDeletedGalleryIds();
    deleted.add(id);
    localStorage.setItem(STORAGE_DELETED_GALLERY_KEY, JSON.stringify(Array.from(deleted)));
  } catch {
    /* ignore */
  }
}

async function withTimeout<T>(fn: () => T | PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<Awaited<T>> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([Promise.resolve(fn()), timeout]);
}

// ----------------------------------------------------
// 1. PRODUCTS HOOK
// ----------------------------------------------------
export function useProducts() {
  const remoteLoadedRef = useRef(false);
  const [state, setState] = useState<AsyncState<Product[]>>(() => {
    const cached = getLocalProducts();
    const deleted = getDeletedProductSlugs();
    const initial = (cached ?? DEFAULT_PRODUCTS).filter(
      (p) => !deleted.has(p.id) && !deleted.has(p.slug)
    );
    return { data: initial, loading: false, error: null };
  });

  const fetchData = useCallback(async () => {
    try {
      const result = await withDedupe<Product[]>(
        'sb:products',
        async () => {
          const cached = getLocalProducts();
          const [sbRes, cloudState] = await Promise.all([
            withTimeout(() =>
              supabase
                .from('products')
                .select('*')
                .order('display_order', { ascending: true }),
              8000
            ).catch(() => ({ data: null, error: null })),
            fetchGlobalStateFromGoogleSheet().catch(() => null),
          ]);

          const data = sbRes.data;
          const error = sbRes.error;
          const deleted = getDeletedProductSlugs();
          const baseList = memoryProducts ?? cached ?? DEFAULT_PRODUCTS;

          // Merge deleted products from cloud
          if (cloudState && Array.isArray(cloudState.deleted_products)) {
            cloudState.deleted_products.forEach((s: string) => {
              markProductDeleted(s);
              deleted.add(s);
            });
          }

          // Merge cloud products from Google Sheets if available
          let workingList = [...baseList];
          if (cloudState && Array.isArray(cloudState.products) && cloudState.products.length > 0) {
            const cloudProducts = cloudState.products as Product[];
            const cloudMap = new Map(cloudProducts.map((p) => [p.slug || p.id, p]));
            workingList = workingList.map((item) => {
              const cp = cloudMap.get(item.slug) || cloudMap.get(item.id);
              if (cp) {
                const itemTime = item.updated_at ? new Date(item.updated_at).getTime() : 0;
                const cpTime = cp.updated_at ? new Date(cp.updated_at).getTime() : 0;
                if (cpTime >= itemTime) return { ...item, ...cp };
              }
              return item;
            });
            for (const cp of cloudProducts) {
              if (!workingList.some((p) => p.slug === cp.slug || p.id === cp.id)) {
                workingList.push(cp);
              }
            }
          }

          if (!error && Array.isArray(data) && data.length > 0) {
            remoteLoadedRef.current = true;
            const remoteList = data as Product[];
            const remoteMap = new Map(remoteList.map((p) => [p.slug || p.id, p]));

            const merged = workingList.map((localItem) => {
              const remoteMatch = remoteMap.get(localItem.slug) || remoteMap.get(localItem.id);
              if (remoteMatch) {
                const localTime = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
                const remoteTime = remoteMatch.updated_at ? new Date(remoteMatch.updated_at).getTime() : 0;
                if (localTime > remoteTime && localTime > 0) {
                  return localItem;
                }
                return { ...localItem, ...remoteMatch };
              }
              return localItem;
            });

            const existingKeys = new Set(merged.flatMap((p) => [p.slug, p.id]));
            for (const r of remoteList) {
              if (!existingKeys.has(r.slug) && !existingKeys.has(r.id)) {
                merged.push(r);
              }
            }

            const filtered = merged.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug));
            memoryProducts = filtered;
            try {
              localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(filtered));
            } catch {
              /* ignore */
            }
            return filtered;
          }

          const filtered = workingList.filter(
            (p) => !deleted.has(p.id) && !deleted.has(p.slug)
          );
          memoryProducts = filtered;
          try {
            localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(filtered));
          } catch {
            /* ignore */
          }
          return filtered;
        },
        CACHE_TTL_SHORT
      );
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const cached = memoryProducts ?? getLocalProducts();
      const deleted = getDeletedProductSlugs();
      setState({
        data: (cached ?? DEFAULT_PRODUCTS).filter((p) => !deleted.has(p.id) && !deleted.has(p.slug)),
        loading: false,
        error: toErrMsg(err, 'Unable to load menu data.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:products');
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const handleLocalUpdate = () => {
      const cached = memoryProducts ?? getLocalProducts();
      const deleted = getDeletedProductSlugs();
      if (cached) {
        const filtered = cached.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug));
        setState({ data: filtered, loading: false, error: null });
      }
    };

    window.addEventListener('pk_products_changed', handleLocalUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_PRODUCTS_KEY) {
        handleLocalUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        invalidateCache('sb:products');
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'PRODUCTS_CHANGED') {
        const d = e.data.data;
        const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
        if (d?.updatedProduct) {
          const up = d.updatedProduct as Product;
          const updated = current.map((p) =>
            p.id === up.id || p.slug === up.slug ? { ...p, ...up } : p
          );
          memoryProducts = updated;
          try {
            localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
          } catch {
            /* ignore */
          }
        } else if (d?.newProduct) {
          const np = d.newProduct as Product;
          if (!current.some((p) => p.id === np.id || p.slug === np.slug)) {
            memoryProducts = [...current, np];
          } else {
            memoryProducts = current.map((p) => (p.id === np.id || p.slug === np.slug ? np : p));
          }
          try {
            localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(memoryProducts));
          } catch {
            /* ignore */
          }
        } else if (d?.productId && d?.action === 'deleted') {
          const pid = d.productId;
          markProductDeleted(pid);
          memoryProducts = current.filter((p) => p.id !== pid && p.slug !== pid);
          try {
            localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(memoryProducts));
          } catch {
            /* ignore */
          }
        }
        const cached = memoryProducts ?? getLocalProducts();
        const deleted = getDeletedProductSlugs();
        if (cached) {
          const filtered = cached.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug));
          setState({ data: filtered, loading: false, error: null });
        }
        invalidateCache('sb:products');
        fetchData();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const channelId = `realtime-products-${Math.random().toString(36).slice(2, 8)}`;
      channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const up = payload.new as Product;
            const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
            const updated = current.map((p) =>
              p.id === up.id || p.slug === up.slug ? { ...p, ...up } : p
            );
            memoryProducts = updated;
            try {
              localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
            } catch {
              /* ignore */
            }
            const deleted = getDeletedProductSlugs();
            setState({
              data: updated.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug)),
              loading: false,
              error: null,
            });
          } else if (payload.eventType === 'INSERT' && payload.new) {
            const np = payload.new as Product;
            const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
            const exists = current.some((p) => p.id === np.id || p.slug === np.slug);
            const updated = exists
              ? current.map((p) => (p.id === np.id || p.slug === np.slug ? np : p))
              : [...current, np];
            memoryProducts = updated;
            try {
              localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
            } catch {
              /* ignore */
            }
            const deleted = getDeletedProductSlugs();
            setState({
              data: updated.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug)),
              loading: false,
              error: null,
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) {
              // Record a tombstone so a later Google Sheets / cache merge cannot resurrect it.
              markProductDeleted(oldId);
              const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
              const updated = current.filter((p) => p.id !== oldId);
              memoryProducts = updated;
              try {
                localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
              } catch {
                /* ignore */
              }
              const deleted = getDeletedProductSlugs();
              setState({
                data: updated.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug)),
                loading: false,
                error: null,
              });
            }
          }
          invalidateCache('sb:products');
          fetchData();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // Periodic background sync for all deployment clients
    const pollInterval = window.setInterval(() => {
      fetchData();
    }, 10_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_products_changed', handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchData]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 2. STORE STATUS HOOK
// ----------------------------------------------------
export function useStoreStatus() {
  const [state, setState] = useState<AsyncState<StoreStatus>>(() => {
    const cached = getLocalStatus();
    return { data: cached ?? DEFAULT_STORE_STATUS, loading: false, error: null };
  });
  const [, setTimeTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const result = await withDedupe<StoreStatus>(
        'sb:store_status',
        async () => {
          const cached = getLocalStatus();
          try {
            const [sbRes, cloudState] = await Promise.all([
              withTimeout(() =>
                supabase
                  .from('store_status')
                  .select('*')
                  .order('last_updated', { ascending: false })
                  .limit(1)
                  .maybeSingle()
              , 8000).catch(() => ({ data: null, error: null })),
              fetchGlobalStateFromGoogleSheet().catch(() => null),
            ]);

            const data = sbRes.data;
            let remoteStatus: StoreStatus | null = null;

            if (data && data.last_updated) {
              // Parse any serialized metadata from updated_by if present
              let parsedClosedDate = (data as Record<string, unknown>).closed_for_date as string | null | undefined;
              let parsedForceOpenDate = (data as Record<string, unknown>).force_open_date as string | null | undefined;
              let parsedOverrideMode: StoreStatus['override_mode'] = (data as Record<string, unknown>).override_mode as StoreStatus['override_mode'];
              if (data.updated_by && typeof data.updated_by === 'string' && data.updated_by.startsWith('{')) {
                try {
                  const meta = JSON.parse(data.updated_by);
                  if (meta.closed_for_date !== undefined) parsedClosedDate = meta.closed_for_date;
                  if (meta.force_open_date !== undefined) parsedForceOpenDate = meta.force_open_date;
                  if (meta.override_mode !== undefined) parsedOverrideMode = meta.override_mode;
                } catch {
                  /* ignore */
                }
              }

              remoteStatus = {
                id: data.id || 'store_status_main',
                is_open: Boolean(data.is_open),
                crowd_level: data.crowd_level || 'Moderate',
                last_updated: data.last_updated || new Date().toISOString(),
                closed_for_date: parsedClosedDate ?? null,
                force_open_date: parsedForceOpenDate ?? null,
                override_mode: parsedOverrideMode ?? null,
                updated_by: data.updated_by,
              };
            }

            // Google Sheets cloud state
            let sheetStatus: StoreStatus | null = null;
            if (cloudState && cloudState.store_status && typeof cloudState.store_status === 'object') {
              sheetStatus = cloudState.store_status as StoreStatus;
            }

            // Supabase is the single source of truth.
            // Google Sheets is a best-effort mirror and is only used as a
            // fallback when Supabase has no usable row at all.
            const bestRemote: StoreStatus | null = remoteStatus || sheetStatus;

            // Keep local status briefly if the author just edited in this browser
            // (guards the small window before the confirmed remote row is fetched).
            if (cached && cached.last_updated) {
              if (Date.now() - lastLocalStoreStatusEditTimestamp < 10_000) {
                return cached;
              }
            }

            if (bestRemote) {
              try {
                localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(bestRemote));
              } catch {
                /* ignore */
              }
              return bestRemote;
            }

            return cached ?? DEFAULT_STORE_STATUS;
          } catch {
            return cached ?? DEFAULT_STORE_STATUS;
          }
        },
        CACHE_TTL_SHORT
      );
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const cached = getLocalStatus();
      setState({
        data: cached ?? DEFAULT_STORE_STATUS,
        loading: false,
        error: toErrMsg(err, 'Unable to load store status.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:store_status');
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const handleLocalUpdate = () => {
      const cached = getLocalStatus();
      if (cached) setState({ data: cached, loading: false, error: null });
    };

    window.addEventListener('pk_store_status_changed', handleLocalUpdate);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        invalidateCache('sb:store_status');
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'STORE_STATUS_CHANGED') {
        const newStatus = e.data.data as StoreStatus;
        if (newStatus) {
          setState({ data: newStatus, loading: false, error: null });
        } else {
          invalidateCache('sb:store_status');
          fetchData();
        }
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-store-status')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_status' }, () => {
          invalidateCache('sb:store_status');
          fetchData();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 10-second timer for Indian Standard Time (IST) auto-trigger & periodic sync
    const timerInterval = window.setInterval(() => {
      setTimeTick((t) => t + 1);
      fetchData();
    }, 10_000);

    return () => {
      window.clearInterval(timerInterval);
      window.removeEventListener('pk_store_status_changed', handleLocalUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchData]);

  const computed = calculateStoreStatus(state.data);

  return {
    ...state,
    computed,
    refetch,
  };
}

// ----------------------------------------------------
// 3. GALLERY HOOK
// ----------------------------------------------------
export function useGallery() {
  const remoteLoadedRef = useRef(false);
  const [state, setState] = useState<AsyncState<GalleryImage[]>>(() => {
    const deleted = getDeletedGalleryIds();
    const cached = getLocalGallery();
    const initial = (cached ?? DEFAULT_GALLERY_IMAGES).filter((img) => !deleted.has(img.id));
    return { data: initial, loading: !cached, error: null };
  });

  // Async load from IndexedDB only if remote hasn't arrived yet
  useEffect(() => {
    idbGet<GalleryImage[]>(STORAGE_GALLERY_KEY).then((idbGallery) => {
      if (remoteLoadedRef.current) return;
      if (idbGallery && idbGallery.length > 0) {
        const deleted = getDeletedGalleryIds();
        const filtered = idbGallery.filter((img) => !deleted.has(img.id));
        if (!remoteLoadedRef.current && filtered.length > 0) {
          memoryGallery = filtered;
          setState((prev) => (remoteLoadedRef.current ? prev : { ...prev, data: filtered, loading: false }));
        }
      }
    });
  }, []);

  const fetchGallery = useCallback(async () => {
    try {
      const result = await withDedupe<GalleryImage[]>(
        'sb:gallery',
        async () => {
          const deleted = getDeletedGalleryIds();
          const [sbRes, cloudState] = await Promise.all([
            withTimeout(
              () =>
                supabase
                  .from('gallery')
                  .select('*')
                  .order('display_order', { ascending: true }),
              8000
            ).catch(() => ({ data: null, error: null })),
            fetchGlobalStateFromGoogleSheet().catch(() => null),
          ]);

          const data = sbRes.data;
          const error = sbRes.error;

          // Merge deleted gallery IDs from cloud
          if (cloudState && Array.isArray(cloudState.deleted_gallery)) {
            cloudState.deleted_gallery.forEach((id: string) => {
              markGalleryImageDeleted(id);
              deleted.add(id);
            });
          }

          const currentLocal = (memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES).filter(
            (img) => !deleted.has(img.id)
          );

          // Merge Google Sheets cloud gallery if available
          let workingGallery = [...currentLocal];
          if (cloudState && Array.isArray(cloudState.gallery) && cloudState.gallery.length > 0) {
            const cloudItems = (cloudState.gallery as GalleryImage[]).map(normalizeGalleryItem);
            const cloudMap = new Map(cloudItems.map((img) => [img.id, img]));
            workingGallery = cloudItems;
            for (const localImg of currentLocal) {
              if (!cloudMap.has(localImg.id)) {
                workingGallery.push(localImg);
              }
            }
          }

          if (!error && Array.isArray(data) && data.length > 0) {
            remoteLoadedRef.current = true;
            const remoteFormatted = (data as GalleryImage[]).map(normalizeGalleryItem);
            // Supabase is the single source of truth. When the authoritative remote
            // read succeeds we must NOT fold the cached copy back in: doing so
            // resurrects media the author already deleted (on another device or in
            // another browser) purely from a stale local cache, even though the
            // database row is gone.
            const filtered = remoteFormatted.filter((img) => !deleted.has(img.id));
            memoryGallery = filtered;
            try {
              localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(filtered));
            } catch {
              /* ignore */
            }
            void idbSet(STORAGE_GALLERY_KEY, filtered);
            return filtered;
          }

          const filtered = workingGallery.filter((img) => !deleted.has(img.id));
          memoryGallery = filtered;
          try {
            localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(filtered));
          } catch {
            /* ignore */
          }
          void idbSet(STORAGE_GALLERY_KEY, filtered);
          return filtered;
        },
        CACHE_TTL_SHORT
      );
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const deleted = getDeletedGalleryIds();
      const cached = (memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES).filter(
        (img) => !deleted.has(img.id)
      );
      setState({
        data: cached,
        loading: false,
        error: toErrMsg(err, 'Unable to load gallery.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:gallery');
    return fetchGallery();
  }, [fetchGallery]);

  useEffect(() => {
    fetchGallery();

    const handleGalleryUpdate = () => {
      const cached = memoryGallery ?? getLocalGallery();
      if (cached) setState({ data: cached, loading: false, error: null });
    };

    window.addEventListener('pk_gallery_changed', handleGalleryUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_GALLERY_KEY) {
        handleGalleryUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Instant refresh when customer unlocks phone or returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        invalidateCache('sb:gallery');
        fetchGallery();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'GALLERY_CHANGED') {
        const deletedId = e.data?.data?.deletedId as string | undefined;
        if (deletedId) {
          // Remember the deletion locally so cached copies cannot bring it back.
          markGalleryImageDeleted(deletedId);
          const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
          const filtered = current.filter((img) => img.id !== deletedId);
          memoryGallery = filtered;
          try {
            localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(filtered));
          } catch {
            /* ignore */
          }
          void idbSet(STORAGE_GALLERY_KEY, filtered);
          setState({ data: filtered, loading: false, error: null });
        } else {
          const cached = memoryGallery ?? getLocalGallery();
          if (cached) setState({ data: cached, loading: false, error: null });
        }
        invalidateCache('sb:gallery');
        fetchGallery();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-gallery')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) {
              // Record a tombstone so a later cache / Google Sheets merge cannot resurrect it.
              markGalleryImageDeleted(oldId);
              const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
              const filtered = current.filter((img) => img.id !== oldId);
              memoryGallery = filtered;
              try {
                localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(filtered));
              } catch {
                /* ignore */
              }
              void idbSet(STORAGE_GALLERY_KEY, filtered);
              setState({ data: filtered, loading: false, error: null });
              broadcastRealtimeEvent('GALLERY_CHANGED', { deletedId: oldId });
            }
          }
          invalidateCache('sb:gallery');
          fetchGallery();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 10-second periodic sync to mirror author updates across customer devices
    const pollInterval = window.setInterval(() => {
      fetchGallery();
    }, 10_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_gallery_changed', handleGalleryUpdate);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchGallery]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 4. REVIEWS HOOK (CUSTOMER FACING)
// ----------------------------------------------------
export function useReviews() {
  const [state, setState] = useState<AsyncState<Review[]>>({
    data: INITIAL_PINNED_REVIEWS,
    loading: false,
    error: null,
  });

  const fetchReviews = useCallback(async () => {
    try {
      // 1. Fetch from Supabase, Google Sheets global state, and Google Sheets feedback
      const [sbRes, cloudState, sheetFeedback] = await Promise.all([
        withTimeout(() =>
          supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false })
        , 8000).catch(() => ({ data: null })),
        fetchGlobalStateFromGoogleSheet().catch(() => null),
        fetchFeedbackFromGoogleSheet().catch(() => []),
      ]);

      // Synchronize featured, unfeatured, and deleted review state from cloud
      if (cloudState && cloudState.reviews_state) {
        const rs = cloudState.reviews_state as { featured?: unknown; unfeatured?: unknown; deleted?: unknown };
        if (Array.isArray(rs.featured)) {
          const fSet = getFeaturedReviewIds();
          rs.featured.forEach((id: string) => fSet.add(id));
          localStorage.setItem(STORAGE_FEATURED_REVIEWS_KEY, JSON.stringify(Array.from(fSet)));
        }
        if (Array.isArray(rs.unfeatured)) {
          const uSet = getUnfeaturedReviewIds();
          rs.unfeatured.forEach((id: string) => uSet.add(id));
          localStorage.setItem(STORAGE_UNFEATURED_REVIEWS_KEY, JSON.stringify(Array.from(uSet)));
        }
        if (Array.isArray(rs.deleted)) {
          const dSet = getDeletedReviewIds();
          rs.deleted.forEach((id: string) => dSet.add(id));
          localStorage.setItem(STORAGE_DELETED_REVIEWS_KEY, JSON.stringify(Array.from(dSet)));
        }
      }

      // Supabase is the single source of truth for customer reviews. A review
      // that was confirmed present remotely and is now missing was deleted —
      // from this device or from another admin/device. Tombstone those IDs so
      // the local cache and the Google Sheets mirror can never bring them back.
      if (Array.isArray(sbRes.data)) {
        reconcileRemoteReviewIds(sbRes.data.map((row) => row.id));
      }

      const deletedIds = getDeletedReviewIds();
      const featuredIds = getFeaturedReviewIds();
      const unfeaturedIds = getUnfeaturedReviewIds();

      const candidateMap = new Map<string, Feedback>();
      if (sbRes.data && Array.isArray(sbRes.data)) {
        sbRes.data.forEach((item: Feedback) => candidateMap.set(item.id, item));
      }
      if (sheetFeedback && Array.isArray(sheetFeedback)) {
        sheetFeedback.forEach((item: Feedback) => {
          if (!candidateMap.has(item.id)) candidateMap.set(item.id, item);
        });
      }
      getLocalFeedbackList().forEach((item) => {
        if (!candidateMap.has(item.id)) candidateMap.set(item.id, item);
      });

      const approvedReviews: Review[] = [];
      let orderIndex = 1;

      for (const [id, f] of candidateMap.entries()) {
        if (deletedIds.has(id)) continue;
        if (unfeaturedIds.has(id)) continue; // explicitly unfeatured by author!

        const isApproved = featuredIds.has(id) || (f.approved === true && !unfeaturedIds.has(id));
        if (isApproved) {
          approvedReviews.push({
            id: f.id,
            rating: f.overall_rating,
            message: f.message || 'Delicious fresh Kachori and great taste!',
            customer_name: f.customer_name || 'Verified Customer',
            display_order: orderIndex++,
            created_at: f.created_at,
            source: 'verified',
          });
        }
      }

      const seenIds = new Set<string>();
      const merged: Review[] = [];

      // Requirement: First Justdial pinned reviews
      INITIAL_PINNED_REVIEWS.forEach((r) => {
        if (!deletedIds.has(r.id) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          merged.push({ ...r, source: 'justdial' });
        }
      });

      // Requirement: Verified reviews featured on homepage
      approvedReviews.forEach((r) => {
        if (!deletedIds.has(r.id) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          merged.push({ ...r, source: 'verified' });
        }
      });

      setState({ data: merged, loading: false, error: null });
    } catch (err) {
      const deletedIds = getDeletedReviewIds();
      const filteredPinned = INITIAL_PINNED_REVIEWS.filter((r) => !deletedIds.has(r.id));
      setState({
        data: filteredPinned,
        loading: false,
        error: toErrMsg(err, 'Unable to load reviews.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:reviews');
    return fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchReviews();

    const handleReviewsChange = () => {
      invalidateCache('sb:reviews');
      fetchReviews();
    };
    window.addEventListener('pk_reviews_changed', handleReviewsChange);

    const handleBroadcast = (e: MessageEvent) => {
      if (
        e.data?.type === 'NEW_FEEDBACK_SUBMITTED' ||
        e.data?.type === 'REVIEW_APPROVED_TOGGLED' ||
        e.data?.type === 'REVIEW_DELETED'
      ) {
        invalidateCache('sb:reviews');
        fetchReviews();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-reviews-customer')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, (payload) => {
          // A DELETE payload carries only the primary key. Tombstone it
          // immediately so the removal is applied even if this device never
          // performed the deletion itself.
          if (payload?.eventType === 'DELETE') {
            const removedId = (payload.old as { id?: string } | undefined)?.id;
            if (removedId) markReviewDeleted(removedId);
          }
          invalidateCache('sb:reviews');
          fetchReviews();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 30-second periodic sync for real-time reviews across all users
    const pollInterval = window.setInterval(() => {
      fetchReviews();
    }, 30_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_reviews_changed', handleReviewsChange);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchReviews]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 5. ALL CUSTOMER FEEDBACK HOOK (AUTHOR PANEL)
// ----------------------------------------------------
export function useFeedbackList() {
  const [state, setState] = useState<AsyncState<Feedback[]>>(() => {
    const local = getLocalFeedbackList();
    const deleted = getDeletedReviewIds();
    const filtered = local.filter((f) => !deleted.has(f.id));
    return { data: filtered.length > 0 ? filtered : null, loading: filtered.length === 0, error: null };
  });

  const fetchFeedback = useCallback(async () => {
    try {
      // Fetch from Supabase, Google Sheet, and Cloud State in parallel
      const [sbRes, sheetData, cloudState] = await Promise.all([
        withTimeout(() =>
          supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false })
        , 8000).catch(() => ({ data: null, error: null })),
        fetchFeedbackFromGoogleSheet().catch(() => []),
        fetchGlobalStateFromGoogleSheet().catch(() => null),
      ]);

      if (cloudState && cloudState.reviews_state) {
        const rs = cloudState.reviews_state as { featured?: unknown; unfeatured?: unknown; deleted?: unknown };
        if (Array.isArray(rs.featured)) {
          const fSet = getFeaturedReviewIds();
          rs.featured.forEach((id: string) => fSet.add(id));
          localStorage.setItem(STORAGE_FEATURED_REVIEWS_KEY, JSON.stringify(Array.from(fSet)));
        }
        if (Array.isArray(rs.unfeatured)) {
          const uSet = getUnfeaturedReviewIds();
          rs.unfeatured.forEach((id: string) => uSet.add(id));
          localStorage.setItem(STORAGE_UNFEATURED_REVIEWS_KEY, JSON.stringify(Array.from(uSet)));
        }
        if (Array.isArray(rs.deleted)) {
          const dSet = getDeletedReviewIds();
          rs.deleted.forEach((id: string) => dSet.add(id));
          localStorage.setItem(STORAGE_DELETED_REVIEWS_KEY, JSON.stringify(Array.from(dSet)));
        }
      }

      // Supabase is the single source of truth for customer reviews. A review
      // that was confirmed present remotely and is now missing was deleted —
      // from this device or from another admin/device. Tombstone those IDs so
      // the local cache and the Google Sheets mirror can never bring them back.
      if (Array.isArray(sbRes.data)) {
        reconcileRemoteReviewIds(sbRes.data.map((row) => row.id));
      }

      const deletedIds = getDeletedReviewIds();
      const featuredIds = getFeaturedReviewIds();
      const unfeaturedIds = getUnfeaturedReviewIds();

      const remoteData = sbRes.data;
      const localData = getLocalFeedbackList();

      const combinedMap = new Map<string, Feedback>();
      const fingerprintMap = new Map<string, string>(); // fingerprint -> id

      const makeFp = (item: Feedback) =>
        `${(item.customer_name || '').toLowerCase().trim()}:::${(item.message || '').toLowerCase().trim()}:::${item.overall_rating}`;

      const computeApproved = (item: Feedback): boolean => {
        if (unfeaturedIds.has(item.id)) return false;
        if (featuredIds.has(item.id)) return true;
        return Boolean(item.approved);
      };

      // 1. Add Supabase rows
      if (remoteData && remoteData.length > 0) {
        remoteData.forEach((item: Feedback) => {
          if (!deletedIds.has(item.id)) {
            const row = { ...item, approved: computeApproved(item) };
            combinedMap.set(item.id, row);
            fingerprintMap.set(makeFp(item), item.id);
          }
        });
      }

      // 2. Add Google Sheet rows (customer submissions)
      if (sheetData && sheetData.length > 0) {
        sheetData.forEach((item: Feedback) => {
          if (!deletedIds.has(item.id)) {
            const fp = makeFp(item);
            const existingId = fingerprintMap.get(fp);
            if (existingId && combinedMap.has(existingId)) {
              const existing = combinedMap.get(existingId)!;
              combinedMap.set(existingId, { ...existing, approved: computeApproved(existing) });
            } else if (!combinedMap.has(item.id)) {
              combinedMap.set(item.id, { ...item, approved: computeApproved(item) });
              fingerprintMap.set(fp, item.id);
            }
          }
        });
      }

      // 3. Add local rows
      localData.forEach((item) => {
        if (!deletedIds.has(item.id)) {
          const fp = makeFp(item);
          const existingId = fingerprintMap.get(fp) || (combinedMap.has(item.id) ? item.id : null);
          if (existingId && combinedMap.has(existingId)) {
            const existing = combinedMap.get(existingId)!;
            combinedMap.set(existingId, { ...existing, ...item, approved: computeApproved(existing) });
          } else {
            combinedMap.set(item.id, { ...item, approved: computeApproved(item) });
            fingerprintMap.set(fp, item.id);
          }
        }
      });

      const list = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      saveLocalFeedbackList(list);
      setState({ data: list, loading: false, error: null });
    } catch (err) {
      const localData = getLocalFeedbackList();
      const deletedIds = getDeletedReviewIds();
      const filtered = localData.filter((f) => !deletedIds.has(f.id));
      setState({
        data: filtered,
        loading: false,
        error: toErrMsg(err, 'Failed to load feedback'),
      });
    }
  }, []);

  const refetch = useCallback(() => fetchFeedback(), [fetchFeedback]);

  useEffect(() => {
    fetchFeedback();

    const handleReviewsChange = () => {
      fetchFeedback();
    };
    window.addEventListener('pk_reviews_changed', handleReviewsChange);

    const handleBroadcast = (e: MessageEvent) => {
      if (
        e.data?.type === 'NEW_FEEDBACK_SUBMITTED' ||
        e.data?.type === 'REVIEW_APPROVED_TOGGLED' ||
        e.data?.type === 'REVIEW_DELETED'
      ) {
        fetchFeedback();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-feedback-admin-panel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, (payload) => {
          // A DELETE payload carries only the primary key. Tombstone it
          // immediately so the removal is applied even if this device never
          // performed the deletion itself.
          if (payload?.eventType === 'DELETE') {
            const removedId = (payload.old as { id?: string } | undefined)?.id;
            if (removedId) markReviewDeleted(removedId);
          }
          fetchFeedback();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 30-second periodic sync for admin panel
    const pollInterval = window.setInterval(() => {
      fetchFeedback();
    }, 30_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_reviews_changed', handleReviewsChange);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchFeedback]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 6. PAGE INITIAL LOAD COORDINATOR
// ----------------------------------------------------
export function useInitialPageLoad(deps: Array<{ loading: boolean; error: string | null }>) {
  const readyRef = useRef(false);
  const allDone = deps.every((d) => !d.loading);
  const hasError = deps.some((d) => d.error);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(() => {
    return deps.length === 0 || allDone;
  });

  useEffect(() => {
    if (readyRef.current) return;
    if (allDone || hasError) {
      readyRef.current = true;
      setInitialLoadComplete(true);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      readyRef.current = true;
      setInitialLoadComplete(true);
    }, 400);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [allDone, hasError, deps.length]);

  return initialLoadComplete;
}

// ----------------------------------------------------
// 7. SUBMIT FEEDBACK ACTION
// ----------------------------------------------------
export type FeedbackPayload = {
  overall_rating: number;
  food_rating: number;
  service_rating: number;
  cleanliness_rating: number;
  message: string;
  customer_name: string;
};

export async function submitFeedback(payload: FeedbackPayload): Promise<{ success: boolean; error?: string }> {
  const overallRating = Number(payload.overall_rating);
  const message = payload.message.trim();

  if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) {
    return { success: false, error: 'Please choose an overall rating from 1 to 5 stars.' };
  }
  if (message.length < 5) {
    return { success: false, error: 'Please share at least a few words of feedback.' };
  }

  const customerName = payload.customer_name.trim() || 'Anonymous Customer';
  const newId = generateUUID();
  const nowIso = new Date().toISOString();

  const newRecord: Feedback = {
    id: newId,
    overall_rating: overallRating,
    food_rating: payload.food_rating || null,
    service_rating: payload.service_rating || null,
    cleanliness_rating: payload.cleanliness_rating || null,
    message,
    customer_name: customerName,
    approved: false,
    created_at: nowIso,
  };

  // 1. Immediately store in local feedback records for instantaneous display
  try {
    const current = getLocalFeedbackList();
    const updated = [newRecord, ...current.filter((f) => f.id !== newId)];
    saveLocalFeedbackList(updated);
  } catch {
    /* ignore */
  }

  // 2. Insert into Supabase (without select to prevent RLS read restrictions)
  try {
    const { error: sbError } = await withTimeout(() =>
      supabase.from('feedback').insert({
        id: newId,
        overall_rating: overallRating,
        food_rating: payload.food_rating || null,
        service_rating: payload.service_rating || null,
        cleanliness_rating: payload.cleanliness_rating || null,
        message,
        customer_name: customerName,
        approved: false,
      })
    );

    if (sbError) {
      console.warn('Supabase feedback insert notice:', sbError.message);
    }
  } catch (err) {
    console.warn('Supabase feedback insert notice:', err);
  }

  // 3. Send to Google Sheets webhook in real-time (awaited to guarantee delivery)
  try {
    await sendFeedbackToGoogleSheet({
      record_id: newRecord.id,
      customer_name: customerName,
      overall_rating: overallRating,
      food_rating: payload.food_rating,
      service_rating: payload.service_rating,
      cleanliness_rating: payload.cleanliness_rating,
      message,
    });
  } catch (sheetErr) {
    console.warn('Google Sheets delivery notice:', sheetErr);
  }

  // 4. Broadcast real-time events across all tabs/windows
  invalidateCache('sb:reviews');
  broadcastRealtimeEvent('NEW_FEEDBACK_SUBMITTED', newRecord);
  window.dispatchEvent(new Event('pk_reviews_changed'));

  return { success: true };
}

// ----------------------------------------------------
// 8. AUTHOR ACTIONS: STORE STATUS
// ----------------------------------------------------
export async function updateStoreStatus(status: {
  is_open: boolean;
  crowd_level: string;
  closed_for_date?: string | null;
  force_open_date?: string | null;
  override_mode?: 'force_open' | 'force_close' | 'closed_now' | 'closed_today' | null;
}): Promise<{ success: boolean; error?: string; remoteSync?: boolean; rlsBlocked?: boolean }> {
  const timestamp = new Date().toISOString();
  const metaObj = {
    closed_for_date: status.closed_for_date ?? null,
    force_open_date: status.force_open_date ?? null,
    override_mode: status.override_mode ?? null,
    updated_at: timestamp,
  };

  const newStatus: StoreStatus = {
    id: 'store_status_main',
    is_open: status.is_open,
    crowd_level: status.crowd_level,
    last_updated: timestamp,
    closed_for_date: status.closed_for_date ?? null,
    force_open_date: status.force_open_date ?? null,
    override_mode: metaObj.override_mode,
    updated_by: JSON.stringify(metaObj),
  };

  const fullPayload: Record<string, unknown> = {
    is_open: status.is_open,
    crowd_level: status.crowd_level,
    last_updated: newStatus.last_updated,
    closed_for_date: newStatus.closed_for_date,
    force_open_date: newStatus.force_open_date,
    override_mode: newStatus.override_mode,
    updated_by: newStatus.updated_by,
  };

  // 1. Supabase is the single source of truth: write to the database FIRST and
  //    only report success once the database has actually confirmed the change.
  let remoteSync = false;
  let rlsBlocked = false;
  let remoteError: string | undefined;

  try {
    const { data: existing, error: selectError } = await withTimeout(() =>
      supabase.from('store_status').select('id').limit(1).maybeSingle()
    );
    if (selectError) {
      return {
        success: false,
        error: `Could not read shop status from the database: ${selectError.message}`,
        remoteSync: false,
      };
    }

    const writeRow = (payload: Record<string, unknown>) => {
      if (existing && existing.id) {
        return withTimeout(() =>
          supabase.from('store_status').update(payload).eq('id', existing.id).select('id')
        );
      }
      return withTimeout(() => supabase.from('store_status').insert(payload).select('id'));
    };

    let rows: Array<{ id: string }> | null = null;
    let error: { code?: string; message?: string } | null = null;
    {
      const res = await writeRow(fullPayload);
      rows = res.data as Array<{ id: string }> | null;
      error = res.error;
    }

    // Graceful fallback only if the override columns have not been migrated yet.
    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column'))) {
      const fallbackPayload = {
        is_open: status.is_open,
        crowd_level: status.crowd_level,
        last_updated: newStatus.last_updated,
        updated_by: newStatus.updated_by,
      };
      const res = await writeRow(fallbackPayload);
      rows = res.data as Array<{ id: string }> | null;
      error = res.error;
    }

    if (error) {
      remoteError = error.message;
    } else if (rows && rows.length > 0) {
      remoteSync = true;
    } else {
      rlsBlocked = true;
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: rlsBlocked
        ? 'The database did not accept the update (permission/RLS blocked). Run the Supabase fix script, then try again.'
        : remoteError || 'The update could not be saved to the database. Please try again.',
      remoteSync: false,
      rlsBlocked,
    };
  }

  // 2. The database confirmed the change — now update local cache, notify other
  //    tabs, and mirror to Google Sheets (best-effort mirror only, never authoritative).
  lastLocalStoreStatusEditTimestamp = Date.now();
  try {
    localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(newStatus));
  } catch {
    /* ignore */
  }

  invalidateCache('sb:store_status');
  broadcastRealtimeEvent('STORE_STATUS_CHANGED', newStatus);
  window.dispatchEvent(new Event('pk_store_status_changed'));

  try {
    void saveGlobalStateToGoogleSheet('store_status', newStatus);
  } catch (sheetErr) {
    console.warn('Google Sheets store status mirror notice:', sheetErr);
  }

  return { success: true, remoteSync: true, rlsBlocked: false };
}

// ----------------------------------------------------
// 9. AUTHOR ACTIONS: PRODUCT UPDATES
// ----------------------------------------------------
export async function updateProduct(
  productIdOrSlug: string,
  updates: Partial<Product>,
  explicitSlug?: string
): Promise<{ success: boolean; error?: string; remoteSync?: boolean }> {
  const timestamp = new Date().toISOString();
  let updatedProduct: Product | undefined;

  // Clean updates: NEVER pass primary key 'id' to Supabase update payload
  const cleanUpdates = { ...updates };
  delete (cleanUpdates as Record<string, unknown>).id;

  const targetSlug = explicitSlug || productIdOrSlug;
  unmarkProductDeleted(productIdOrSlug);
  if (explicitSlug) unmarkProductDeleted(explicitSlug);

  try {
    const currentProducts = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
    let found = false;

    const updated = currentProducts.map((p) => {
      const isMatch =
        p.id === productIdOrSlug ||
        p.slug === targetSlug ||
        (explicitSlug && p.slug === explicitSlug) ||
        p.slug === productIdOrSlug;

      if (isMatch) {
        found = true;
        updatedProduct = { ...p, ...cleanUpdates, updated_at: timestamp };
        return updatedProduct;
      }
      return p;
    });

    if (!found) {
      const defaultMatch = DEFAULT_PRODUCTS.find(
        (d) => d.slug === targetSlug || d.id === productIdOrSlug || (explicitSlug && d.slug === explicitSlug)
      );
      if (defaultMatch) {
        updatedProduct = { ...defaultMatch, ...cleanUpdates, updated_at: timestamp };
        updated.push(updatedProduct);
      }
    }

    memoryProducts = updated;
    try {
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }

  invalidateCache('sb:products');
  broadcastRealtimeEvent('PRODUCTS_CHANGED', {
    productId: productIdOrSlug,
    slug: explicitSlug || updatedProduct?.slug,
    updates: cleanUpdates,
    updatedProduct,
    timestamp,
  });
  window.dispatchEvent(new Event('pk_products_changed'));

  // Sync to Google Sheets cloud state for all users and devices
  try {
    const prods = (memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS).filter(
      (p) => !getDeletedProductSlugs().has(p.id) && !getDeletedProductSlugs().has(p.slug)
    );
    void saveGlobalStateToGoogleSheet('products', prods);
  } catch (sheetErr) {
    console.warn('Google Sheets products sync notice:', sheetErr);
  }

  // Await remote sync to Supabase with proper timeout so author and deployment stay 100% in sync
  let remoteSync = false;
  let remoteError = '';
  try {
    const slugToUpdate = explicitSlug || updatedProduct?.slug || productIdOrSlug;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdOrSlug);

    const payload: Record<string, unknown> = {
      updated_at: timestamp,
    };
    if (cleanUpdates.name !== undefined) payload.name = String(cleanUpdates.name).trim();
    if (cleanUpdates.price !== undefined) payload.price = Number(cleanUpdates.price);
    if (cleanUpdates.description !== undefined) payload.description = String(cleanUpdates.description).trim();
    if (cleanUpdates.image_url !== undefined) payload.image_url = String(cleanUpdates.image_url).trim();
    if (cleanUpdates.available !== undefined) payload.available = Boolean(cleanUpdates.available);
    if (cleanUpdates.stock !== undefined) payload.stock = Number(cleanUpdates.stock);
    if (cleanUpdates.featured !== undefined) payload.featured = Boolean(cleanUpdates.featured);
    if (cleanUpdates.display_order !== undefined) payload.display_order = Number(cleanUpdates.display_order);

    // 1. If valid UUID, attempt update by primary key id
    if (isUuid) {
      const { data, error } = await withTimeout(
        () =>
          supabase
            .from('products')
            .update(payload)
            .eq('id', productIdOrSlug)
            .select(),
        8000
      );
      if (!error && data && data.length > 0) {
        remoteSync = true;
        const returnedRow = data[0] as Product;
        updatedProduct = returnedRow;
        unmarkProductDeleted(returnedRow.id);
        unmarkProductDeleted(returnedRow.slug);
        const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
        const updated = current.map((p) =>
          p.id === returnedRow.id || p.slug === returnedRow.slug ? returnedRow : p
        );
        memoryProducts = updated;
        try {
          localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
      } else if (error) {
        remoteError = error.message;
      }
    }

    // 2. If not UUID or not matched yet, update by slug
    if (!remoteSync && slugToUpdate) {
      const { data, error } = await withTimeout(
        () =>
          supabase
            .from('products')
            .update(payload)
            .eq('slug', slugToUpdate)
            .select(),
        8000
      );
      if (!error && data && data.length > 0) {
        remoteSync = true;
        const returnedRow = data[0] as Product;
        updatedProduct = returnedRow;
        unmarkProductDeleted(returnedRow.id);
        unmarkProductDeleted(returnedRow.slug);
        const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
        const updated = current.map((p) =>
          p.id === returnedRow.id || p.slug === returnedRow.slug ? returnedRow : p
        );
        memoryProducts = updated;
        try {
          localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
      } else if (error) {
        remoteError = error.message;
      }
    }

    // 3. Fallback: if row didn't exist in Supabase yet, upsert it by slug
    if (!remoteSync && updatedProduct && slugToUpdate) {
      const { data, error } = await withTimeout(
        () =>
          supabase
            .from('products')
            .upsert(
              {
                slug: slugToUpdate,
                name: updatedProduct!.name,
                price: Number(updatedProduct!.price),
                description: updatedProduct!.description || '',
                image_url: updatedProduct!.image_url || '',
                available: updatedProduct!.available ?? true,
                stock: Number(updatedProduct!.stock ?? 50),
                featured: Boolean(updatedProduct!.featured),
                display_order: updatedProduct!.display_order ?? 1,
                updated_at: timestamp,
              },
              { onConflict: 'slug' }
            )
            .select(),
        8000
      );
      if (!error && data && data.length > 0) {
        remoteSync = true;
        const returnedRow = data[0] as Product;
        updatedProduct = returnedRow;
        unmarkProductDeleted(returnedRow.id);
        unmarkProductDeleted(returnedRow.slug);
        const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
        const updated = current.map((p) =>
          p.id === returnedRow.id || p.slug === returnedRow.slug ? returnedRow : p
        );
        memoryProducts = updated;
        try {
          localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
        } catch {
          /* ignore */
        }
      } else if (error) {
        remoteError = error.message;
      }
    }
  } catch (err) {
    console.warn('Remote sync product notice (offline/RLS):', err);
    remoteError = toErrMsg(err);
  }

  // Supabase is authoritative: only report success once the database confirmed.
  if (!remoteSync) {
    return {
      success: false,
      remoteSync: false,
      error: remoteError || 'The product change could not be saved to the database. Please try again.',
    };
  }

  return { success: true, remoteSync: true };
}

export async function addProduct(
  productData: Omit<Product, 'id'> & { id?: string }
): Promise<{ success: boolean; data?: Product; error?: string }> {
  const timestamp = new Date().toISOString();
  const slug =
    productData.slug?.trim() ||
    productData.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') ||
    `item-${Date.now()}`;

  const currentProducts = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
  let createdId = productData.id || generateUUID();
  unmarkProductDeleted(slug);
  unmarkProductDeleted(createdId);

  // Supabase is authoritative: insert first and only continue once it is stored.
  let remoteSync = false;
  let remoteError = '';
  try {
    const { data, error } = await withTimeout(
      () =>
        supabase
          .from('products')
          .insert({
            id: createdId,
            slug,
            name: productData.name.trim(),
            price: Number(productData.price) || 40,
            description: productData.description?.trim() || '',
            image_url: productData.image_url || '/images/kachori.webp',
            available: productData.available !== undefined ? productData.available : true,
            stock: productData.stock !== undefined ? Number(productData.stock) : 50,
            featured: Boolean(productData.featured),
            display_order: productData.display_order ?? currentProducts.length + 1,
          })
          .select()
          .maybeSingle(),
      8000
    );
    if (!error && data?.id) {
      createdId = data.id;
      remoteSync = true;
    } else if (error) {
      remoteError = error.message;
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: remoteError || 'The product could not be added to the database. Please try again.',
    };
  }

  const newProduct: Product = {
    id: createdId,
    slug,
    name: productData.name.trim(),
    price: Number(productData.price) || 40,
    description: productData.description?.trim() || '',
    image_url: productData.image_url || '/images/kachori.webp',
    available: productData.available !== undefined ? productData.available : true,
    stock: productData.stock !== undefined ? Number(productData.stock) : 50,
    featured: Boolean(productData.featured),
    display_order: productData.display_order ?? currentProducts.length + 1,
    updated_at: timestamp,
  };

  const updatedList = [...currentProducts.filter((p) => p.slug !== slug), newProduct];
  memoryProducts = updatedList;

  try {
    localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updatedList));
  } catch {
    /* ignore */
  }

  invalidateCache('sb:products');
  broadcastRealtimeEvent('PRODUCTS_CHANGED', {
    productId: createdId,
    slug,
    newProduct,
    timestamp,
  });
  window.dispatchEvent(new Event('pk_products_changed'));

  // Sync to Google Sheets cloud state for all users and devices
  try {
    void saveGlobalStateToGoogleSheet('products', updatedList);
  } catch (sheetErr) {
    console.warn('Google Sheets products sync notice:', sheetErr);
  }

  return { success: true, data: newProduct };
}

export async function deleteProduct(
  productIdOrSlug: string
): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdOrSlug);
  const column = isUuid ? 'id' : 'slug';

  // Supabase is authoritative: delete from the database first, then verify.
  let remoteSync = false;
  let remoteError = '';
  try {
    const { error } = await withTimeout(
      () => supabase.from('products').delete().eq(column, productIdOrSlug).select('id'),
      8000
    );
    if (error) {
      remoteError = error.message;
    } else {
      // RLS can silently block deletes, so confirm the row is actually gone.
      const { data: stillThere, error: verifyErr } = await withTimeout(
        () => supabase.from('products').select('id').eq(column, productIdOrSlug).maybeSingle(),
        8000
      );
      if (verifyErr) {
        remoteError = verifyErr.message;
      } else if (stillThere) {
        remoteError =
          'The database did not delete this product (permission/RLS blocked). Run the Supabase fix script, then try again.';
      } else {
        remoteSync = true;
      }
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: remoteError || 'The product could not be deleted from the database. Please try again.',
    };
  }

  // The database confirmed the delete — now update local state and notify tabs.
  try {
    markProductDeleted(productIdOrSlug);
    const currentProducts = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
    const targetProduct = currentProducts.find(
      (p) => p.id === productIdOrSlug || p.slug === productIdOrSlug
    );
    if (targetProduct) {
      markProductDeleted(targetProduct.id);
      markProductDeleted(targetProduct.slug);
    }
    const updated = currentProducts.filter(
      (p) => p.id !== productIdOrSlug && p.slug !== productIdOrSlug
    );
    memoryProducts = updated;
    try {
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }

  invalidateCache('sb:products');
  broadcastRealtimeEvent('PRODUCTS_CHANGED', {
    productId: productIdOrSlug,
    action: 'deleted',
    timestamp,
  });
  window.dispatchEvent(new Event('pk_products_changed'));

  // Google Sheets is a best-effort mirror only.
  try {
    const currentProducts = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
    const deleted = getDeletedProductSlugs();
    const remaining = currentProducts.filter((p) => !deleted.has(p.id) && !deleted.has(p.slug));
    void saveGlobalStateToGoogleSheet('products', remaining);
    void saveGlobalStateToGoogleSheet('deleted_products', Array.from(deleted));
  } catch (sheetErr) {
    console.warn('Google Sheets products delete sync notice:', sheetErr);
  }

  return { success: true };
}

// ----------------------------------------------------
// 10. AUTHOR ACTIONS: GALLERY MANAGEMENT
// ----------------------------------------------------
export async function addGalleryImage(
  image: Omit<GalleryImage, 'id'>
): Promise<{ success: boolean; data?: GalleryImage; error?: string }> {
  const newId = generateUUID();
  const normalized = normalizeGalleryItem({
    id: newId,
    src: image.src,
    alt: image.alt || 'Paras Kachoriwala Media',
    category: image.category || 'food',
    media_type: image.media_type,
    caption: image.caption || '',
    display_order: image.display_order ?? 99,
    created_at: new Date().toISOString(),
  });

  // Supabase is authoritative: insert first and only continue once it is stored.
  let remoteSync = false;
  let remoteError = '';
  try {
    const { data, error } = await withTimeout(
      () =>
        supabase
          .from('gallery')
          .insert({
            id: newId,
            src: normalized.src,
            alt: normalized.alt,
            category: normalized.category,
            caption: normalized.caption,
            display_order: normalized.display_order,
          })
          .select()
          .maybeSingle(),
      10000
    );
    if (!error && data?.id) {
      normalized.id = data.id;
      remoteSync = true;
    } else if (error) {
      remoteError = error.message;
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: remoteError || 'The media could not be saved to the database. Please try again.',
    };
  }

  // 2. The database confirmed the insert — now persist locally, notify tabs and mirror.
  const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
  const updated = [normalized, ...current.filter((g) => g.id !== normalized.id)];
  memoryGallery = updated;

  try {
    localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  await idbSet(STORAGE_GALLERY_KEY, updated);

  invalidateCache('sb:gallery');
  broadcastRealtimeEvent('GALLERY_CHANGED');
  window.dispatchEvent(new Event('pk_gallery_changed'));

  // Google Sheets is a best-effort mirror only.
  try {
    void saveGlobalStateToGoogleSheet('gallery', updated);
  } catch (sheetErr) {
    console.warn('Google Sheets gallery sync notice:', sheetErr);
  }

  return { success: true, data: normalized };
}

export async function updateGalleryImage(
  id: string,
  updates: Partial<GalleryImage>
): Promise<{ success: boolean; error?: string }> {
  // Supabase gallery table does not have a media_type column
  const { media_type, ...supabaseUpdates } = updates as Record<string, unknown>;
  void media_type;

  // Supabase is authoritative: write to the database first.
  if (Object.keys(supabaseUpdates).length > 0) {
    let remoteSync = false;
    let remoteError = '';
    try {
      const { data, error } = await withTimeout(
        () => supabase.from('gallery').update(supabaseUpdates).eq('id', id).select('id'),
        8000
      );
      if (error) {
        remoteError = error.message;
      } else if (data && data.length > 0) {
        remoteSync = true;
      } else {
        remoteError =
          'The database did not accept the gallery update (permission/RLS blocked). Run the Supabase fix script, then try again.';
      }
    } catch (err) {
      remoteError = toErrMsg(err, 'Unable to reach the database.');
    }

    if (!remoteSync) {
      return {
        success: false,
        error: remoteError || 'The gallery update could not be saved to the database. Please try again.',
      };
    }
  }

  // The database confirmed the change — now persist locally and notify tabs.
  const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
  const updated = current.map((img) => (img.id === id ? { ...img, ...updates } : img));
  memoryGallery = updated;

  try {
    localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  await idbSet(STORAGE_GALLERY_KEY, updated);

  invalidateCache('sb:gallery');
  broadcastRealtimeEvent('GALLERY_CHANGED');
  window.dispatchEvent(new Event('pk_gallery_changed'));

  // Google Sheets is a best-effort mirror only.
  try {
    void saveGlobalStateToGoogleSheet('gallery', updated);
  } catch (sheetErr) {
    console.warn('Google Sheets gallery update sync notice:', sheetErr);
  }

  return { success: true };
}

export async function deleteGalleryImage(id: string): Promise<{ success: boolean; error?: string }> {
  // Prevent duplicate/parallel delete requests for the same item.
  if (galleryDeletionsInFlight.has(id)) {
    return { success: false, error: 'This media is already being deleted. Please wait a moment.' };
  }
  galleryDeletionsInFlight.add(id);

  try {
    const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
    const targetImg = current.find((img) => img.id === id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Nothing identifiable to delete remotely.
    if (!isUuid && !targetImg?.src) {
      return { success: true };
    }

    const removedIds = new Set<string>();
    let remoteSync = false;
    let remoteError = '';

    try {
      // 1. Read the authoritative list once. Reading the full (small) table avoids
      //    putting a large base64 `src` into the request URL, which would 414.
      const { data: rows, error: listErr } = await withTimeout(
        () => supabase.from('gallery').select('id,src'),
        10000
      );
      if (listErr) {
        remoteError = listErr.message;
      } else {
        // 2. Collect every row that refers to this media — by id AND by source — so
        //    that a stale local id or a duplicate/orphaned row is removed too,
        //    instead of reporting success while the real row silently survives.
        const targets = (rows || []).filter(
          (row) => (isUuid && row.id === id) || (!!targetImg?.src && row.src === targetImg.src)
        );

        let deleteError = '';
        for (const row of targets) {
          const { error: dErr } = await withTimeout(
            () => supabase.from('gallery').delete().eq('id', row.id).select('id'),
            8000
          );
          if (dErr) deleteError = dErr.message;
          else removedIds.add(row.id);
        }

        if (deleteError) {
          remoteError = deleteError;
        } else {
          // 3. Verify: re-read and confirm nothing still references this media.
          const { data: after, error: vErr } = await withTimeout(
            () => supabase.from('gallery').select('id,src'),
            8000
          );
          if (vErr) {
            remoteError = vErr.message;
          } else {
            const stillThere = (after || []).some(
              (row) => (isUuid && row.id === id) || (!!targetImg?.src && row.src === targetImg.src)
            );
            if (stillThere) {
              remoteError =
                'The database did not delete this media (permission/RLS blocked). Run the Supabase fix script, then try again.';
            } else {
              remoteSync = true;
            }
          }
        }
      }
    } catch (err) {
      remoteError = toErrMsg(err, 'Unable to reach the database.');
    }

    if (!remoteSync) {
      return {
        success: false,
        error: remoteError || 'The media could not be deleted from the database. Please try again.',
      };
    }

    // The database confirmed the delete — now update local state and notify tabs.
    // Tombstone every id that was actually removed so no cached copy can resurrect it.
    markGalleryImageDeleted(id);
    for (const removedId of removedIds) markGalleryImageDeleted(removedId);
    const deleted = getDeletedGalleryIds();
    const currentFiltered = current.filter(
      (img) =>
        img.id !== id && !deleted.has(img.id) && (!targetImg?.src || img.src !== targetImg.src)
    );
    memoryGallery = currentFiltered;

    try {
      localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(currentFiltered));
    } catch {
      /* ignore */
    }
    await idbSet(STORAGE_GALLERY_KEY, currentFiltered);

    invalidateCache('sb:gallery');
    broadcastRealtimeEvent('GALLERY_CHANGED', { deletedId: id });
    window.dispatchEvent(new Event('pk_gallery_changed'));

    // Google Sheets is a best-effort mirror only.
    try {
      void saveGlobalStateToGoogleSheet('gallery', currentFiltered);
      void saveGlobalStateToGoogleSheet('deleted_gallery', Array.from(deleted));
    } catch (sheetErr) {
      console.warn('Google Sheets gallery delete sync notice:', sheetErr);
    }

    return { success: true };
  } finally {
    galleryDeletionsInFlight.delete(id);
  }
}

export async function clearAllGalleryImages(): Promise<{ success: boolean; error?: string }> {
  // Supabase is authoritative: clear the database first and verify it is empty.
  let remoteSync = false;
  let remoteError = '';
  try {
    const { data: rows, error } = await withTimeout(() => supabase.from('gallery').select('id'), 10000);
    if (error) {
      remoteError = error.message;
    } else {
      let deleteFailed = false;
      for (const r of rows || []) {
        const { error: dErr } = await withTimeout(
          () => supabase.from('gallery').delete().eq('id', r.id).select('id'),
          8000
        );
        if (dErr) {
          deleteFailed = true;
          remoteError = dErr.message;
        }
      }
      if (!deleteFailed) {
        const { data: remaining, error: vErr } = await withTimeout(
          () => supabase.from('gallery').select('id').limit(1),
          8000
        );
        if (vErr) remoteError = vErr.message;
        else if (remaining && remaining.length > 0) {
          remoteError =
            'The database did not clear the gallery (permission/RLS blocked). Run the Supabase fix script, then try again.';
        } else remoteSync = true;
      }
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: remoteError || 'The gallery could not be cleared in the database. Please try again.',
    };
  }

  // The database confirmed the clear — now update local state and notify tabs.
  memoryGallery = [];
  try {
    localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify([]));
    localStorage.removeItem(STORAGE_DELETED_GALLERY_KEY);
  } catch {
    /* ignore */
  }
  await idbSet(STORAGE_GALLERY_KEY, []);

  invalidateCache('sb:gallery');
  broadcastRealtimeEvent('GALLERY_CHANGED');
  window.dispatchEvent(new Event('pk_gallery_changed'));

  // Google Sheets is a best-effort mirror only.
  try {
    void saveGlobalStateToGoogleSheet('gallery', []);
  } catch (sheetErr) {
    console.warn('Google Sheets gallery clear sync notice:', sheetErr);
  }

  return { success: true };
}

/**
 * Ensures the author's local gallery state is safely mirrored in Supabase.
 * Note: Never deletes remote items unless they were explicitly marked in deletedIds.
 * If Supabase is empty, seeds the default gallery items into the database.
 */
export async function syncAuthorGalleryToSupabase(): Promise<{
  success: boolean;
  syncedCount: number;
  error?: string;
}> {
  try {
    const deletedIds = getDeletedGalleryIds();

    // 1. Fetch remote items from Supabase
    const { data: remoteRows, error: fetchErr } = await withTimeout(() =>
      supabase.from('gallery').select('*').order('display_order', { ascending: true }),
      10000
    );

    if (fetchErr) {
      return { success: false, syncedCount: 0, error: fetchErr.message };
    }

    const remoteItems = (remoteRows || []) as GalleryImage[];

    // 2. Remove remote items that were EXPLICITLY marked deleted by author
    if (deletedIds.size > 0) {
      for (const r of remoteItems) {
        if (deletedIds.has(r.id)) {
          await withTimeout(() => supabase.from('gallery').delete().eq('id', r.id), 8000).catch(() => {});
        }
      }
    }

    // 3. If Supabase gallery is empty, seed default starter photos so customer phones immediately see gallery
    if (remoteItems.length === 0) {
      for (const def of DEFAULT_GALLERY_IMAGES) {
        if (!deletedIds.has(def.id)) {
          await withTimeout(() =>
            supabase.from('gallery').insert({
              id: def.id,
              src: def.src,
              alt: def.alt,
              category: def.category,
              caption: def.caption || '',
              display_order: def.display_order ?? 0,
            })
          , 8000).catch(() => {});
        }
      }
    }

    // 4. Safely sync any valid local items that might be missing from Supabase
    const localItems = (memoryGallery ?? getLocalGallery() ?? []).filter(
      (img) => !deletedIds.has(img.id)
    );
    const remoteIdSet = new Set(remoteItems.map((r) => r.id));
    const remoteSrcSet = new Set(remoteItems.map((r) => r.src));

    let synced = 0;
    for (const local of localItems) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(local.id);
      if (!remoteIdSet.has(local.id) && !remoteSrcSet.has(local.src) && isUuid) {
        await withTimeout(() =>
          supabase.from('gallery').insert({
            id: local.id,
            src: local.src,
            alt: local.alt || 'Paras Kachoriwala Media',
            category: local.category || 'food',
            caption: local.caption || '',
            display_order: local.display_order ?? 0,
          })
        , 8000).catch(() => {});
        synced++;
      }
    }

    invalidateCache('sb:gallery');
    broadcastRealtimeEvent('GALLERY_CHANGED');
    window.dispatchEvent(new Event('pk_gallery_changed'));

    return { success: true, syncedCount: synced };
  } catch (err) {
    return { success: false, syncedCount: 0, error: toErrMsg(err, 'Cloud sync failed') };
  }
}

// ----------------------------------------------------
// 11. AUTHOR ACTIONS: FEEDBACK / REVIEWS MANAGEMENT
// ----------------------------------------------------
export async function toggleApproveFeedback(
  id: string,
  approved: boolean
): Promise<{ success: boolean; error?: string }> {
  // Supabase is authoritative: write to the database first and only report
  // success once the database has confirmed the change.
  let remoteSync = false;
  let remoteError = '';
  try {
    const { data, error } = await withTimeout(
      () => supabase.from('feedback').update({ approved }).eq('id', id).select('id'),
      8000
    );
    if (error) {
      remoteError = error.message;
    } else if (data && data.length > 0) {
      remoteSync = true;
    } else if (approved) {
      // The review is not in the database yet (local-only review) — insert it.
      const target = getLocalFeedbackList().find((f) => f.id === id);
      if (target) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const rowId = isUuid ? id : generateUUID();
        const { data: inserted, error: insErr } = await withTimeout(
          () =>
            supabase
              .from('feedback')
              .insert({
                id: rowId,
                overall_rating: target.overall_rating,
                food_rating: target.food_rating,
                service_rating: target.service_rating,
                cleanliness_rating: target.cleanliness_rating,
                message: target.message,
                customer_name: target.customer_name,
                approved: true,
              })
              .select('id')
              .maybeSingle(),
          8000
        );
        if (!insErr && inserted?.id) {
          remoteSync = true;
        } else if (insErr) {
          remoteError = insErr.message;
        }
      } else {
        remoteError = 'This review could not be found in the database.';
      }
    } else {
      // Un-approving a review that is not stored in the database: nothing to persist.
      remoteSync = true;
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: remoteError || 'The review could not be updated in the database. Please try again.',
    };
  }

  // 1. Explicitly track featured vs unfeatured review IDs
  if (approved) {
    markReviewFeatured(id);
  } else {
    markReviewUnfeatured(id);
  }

  // Also check if there are duplicate or linked IDs with same message/customer_name
  try {
    const list = getLocalFeedbackList();
    const target = list.find((f) => f.id === id);
    if (target) {
      const fp = `${(target.customer_name || '').toLowerCase().trim()}:::${(target.message || '').toLowerCase().trim()}:::${target.overall_rating}`;
      list.forEach((f) => {
        const itemFp = `${(f.customer_name || '').toLowerCase().trim()}:::${(f.message || '').toLowerCase().trim()}:::${f.overall_rating}`;
        if (itemFp === fp) {
          if (approved) markReviewFeatured(f.id);
          else markReviewUnfeatured(f.id);
        }
      });
    }
  } catch {
    /* ignore */
  }

  // 2. Update in local storage list
  try {
    const list = getLocalFeedbackList();
    const updated = list.map((f) => (f.id === id ? { ...f, approved } : f));
    saveLocalFeedbackList(updated);
  } catch {
    /* ignore */
  }

  // 3. Broadcast immediately
  invalidateCache('sb:reviews');
  broadcastRealtimeEvent('REVIEW_APPROVED_TOGGLED', { id, approved });
  window.dispatchEvent(new Event('pk_reviews_changed'));

  // 4. Google Sheets is a best-effort mirror only.
  try {
    void saveGlobalStateToGoogleSheet('reviews_state', {
      featured: Array.from(getFeaturedReviewIds()),
      unfeatured: Array.from(getUnfeaturedReviewIds()),
      deleted: Array.from(getDeletedReviewIds()),
    });
  } catch (sheetErr) {
    console.warn('Google Sheets review approve sync notice:', sheetErr);
  }

  return { success: true };
}

export async function deleteFeedback(feedbackId: string): Promise<{ success: boolean; error?: string }> {
  // Supabase is authoritative: delete from the database first and verify.
  let remoteSync = false;
  let remoteError = '';
  try {
    const { error } = await withTimeout(
      () => supabase.from('feedback').delete().eq('id', feedbackId).select('id'),
      8000
    );
    if (error) {
      remoteError = error.message;
    } else {
      // RLS can silently block deletes, so confirm the row is actually gone.
      const { data: still, error: vErr } = await withTimeout(
        () => supabase.from('feedback').select('id').eq('id', feedbackId).maybeSingle(),
        8000
      );
      if (vErr) {
        remoteError = vErr.message;
      } else if (still) {
        remoteError =
          'The database did not delete this review (permission/RLS blocked). Run the Supabase fix script, then try again.';
      } else {
        remoteSync = true;
      }
    }
  } catch (err) {
    remoteError = toErrMsg(err, 'Unable to reach the database.');
  }

  if (!remoteSync) {
    return {
      success: false,
      error: remoteError || 'The review could not be deleted from the database. Please try again.',
    };
  }

  // The database confirmed the delete — now update local state and notify tabs.
  // 1. Permanently mark deleted locally
  markReviewDeleted(feedbackId);

  // Also check if there are duplicate or linked IDs with same message/customer_name
  try {
    const list = getLocalFeedbackList();
    const target = list.find((f) => f.id === feedbackId);
    if (target) {
      const fp = `${(target.customer_name || '').toLowerCase().trim()}:::${(target.message || '').toLowerCase().trim()}:::${target.overall_rating}`;
      list.forEach((f) => {
        const itemFp = `${(f.customer_name || '').toLowerCase().trim()}:::${(f.message || '').toLowerCase().trim()}:::${f.overall_rating}`;
        if (itemFp === fp) {
          markReviewDeleted(f.id);
        }
      });
    }
  } catch {
    /* ignore */
  }

  // 2. Remove from local feedback records
  try {
    const list = getLocalFeedbackList();
    const updated = list.filter((f) => f.id !== feedbackId);
    saveLocalFeedbackList(updated);
  } catch {
    /* ignore */
  }

  // 3. Broadcast deletion immediately across tabs & window
  invalidateCache('sb:reviews');
  broadcastRealtimeEvent('REVIEW_DELETED', { id: feedbackId });
  window.dispatchEvent(new Event('pk_reviews_changed'));

  // 4. Google Sheets is a best-effort mirror only.
  try {
    void saveGlobalStateToGoogleSheet('reviews_state', {
      featured: Array.from(getFeaturedReviewIds()),
      unfeatured: Array.from(getUnfeaturedReviewIds()),
      deleted: Array.from(getDeletedReviewIds()),
    });
  } catch (sheetErr) {
    console.warn('Google Sheets review delete sync notice:', sheetErr);
  }

  return { success: true };
}

// ----------------------------------------------------
// 12. DATABASE & REAL-TIME CLOUD HEALTH DIAGNOSTIC
// ----------------------------------------------------
export type SupabaseHealthStatus = {
  isHealthy: boolean;
  storeStatusWritable: boolean;
  productsWritable: boolean;
  galleryTableExists: boolean;
  feedbackWritable: boolean;
  errorMessage?: string;
};

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  let storeStatusWritable = false;
  let productsWritable = false;
  let galleryTableExists = false;
  let feedbackWritable = false;
  let errorMessage = '';

  try {
    // 1. Check store_status write permission
    const { data: statusRows, error: sErr } = await supabase.from('store_status').select('id, last_updated').limit(1);
    if (!sErr && statusRows && statusRows.length > 0) {
      const { data: updatedRows, error: updateErr } = await supabase
        .from('store_status')
        .update({ last_updated: statusRows[0].last_updated })
        .eq('id', statusRows[0].id)
        .select();
      if (!updateErr && updatedRows && updatedRows.length > 0) {
        storeStatusWritable = true;
      }
    }

    // 2. Check products write permission
    const { data: prodRows, error: pErr } = await supabase.from('products').select('id, price').limit(1);
    if (!pErr && prodRows && prodRows.length > 0) {
      const { data: updatedProd, error: prodErr } = await supabase
        .from('products')
        .update({ price: prodRows[0].price })
        .eq('id', prodRows[0].id)
        .select();
      if (!prodErr && updatedProd && updatedProd.length > 0) {
        productsWritable = true;
      }
    }

    // 3. Check gallery table existence
    const { error: galErr } = await supabase.from('gallery').select('id').limit(1);
    if (!galErr) {
      galleryTableExists = true;
    }

    // 4. Check feedback write permission
    const { data: fbRows, error: fbErr } = await supabase.from('feedback').select('id, approved').limit(1);
    if (!fbErr && fbRows && fbRows.length > 0) {
      const { data: updatedFb, error: fbUpdateErr } = await supabase
        .from('feedback')
        .update({ approved: fbRows[0].approved })
        .eq('id', fbRows[0].id)
        .select();
      if (!fbUpdateErr && updatedFb && updatedFb.length > 0) {
        feedbackWritable = true;
      }
    } else if (!fbErr) {
      feedbackWritable = true;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const isHealthy = storeStatusWritable && productsWritable && galleryTableExists && feedbackWritable;
  return {
    isHealthy,
    storeStatusWritable,
    productsWritable,
    galleryTableExists,
    feedbackWritable,
    errorMessage,
  };
}
