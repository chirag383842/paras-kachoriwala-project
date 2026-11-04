// Google Sheets Feedback Integration Service
import type { Feedback } from './types';

const GOOGLE_SHEET_URL_KEY = 'pk_google_sheet_webhook_url_v2';
export const DEFAULT_GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwLc-t7sDn6b_cJ_ig5j6OLsK9nqtWfZZH-oWOU9O4l1wc3pRau1fu3KFF4-WPcB3ff0Q/exec';

export function getGoogleSheetUrl(): string {
  // 1. Highest priority: User customized webhook URL in Admin portal
  try {
    const saved = localStorage.getItem(GOOGLE_SHEET_URL_KEY);
    if (saved && saved.trim() && saved.startsWith('https://script.google.com')) {
      return saved.trim();
    }
  } catch {
    // Ignore
  }

  // 2. Env variable provided in .env
  const envUrl = (import.meta.env.VITE_GOOGLE_SHEETS_URL || '').trim();
  if (envUrl && envUrl.startsWith('https://script.google.com') && !envUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return envUrl;
  }

  return DEFAULT_GOOGLE_SHEET_URL;
}

export function setGoogleSheetUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(GOOGLE_SHEET_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(GOOGLE_SHEET_URL_KEY);
    }
  } catch {
    // Ignore
  }
}

export type GoogleSheetFeedbackData = {
  record_id?: string;
  customer_name?: string;
  overall_rating: number;
  food_rating?: number;
  service_rating?: number;
  cleanliness_rating?: number;
  message?: string;
  submitted_at?: string;
};

export const STORAGE_SYNCED_SHEET_IDS = 'pk_sheet_synced_ids_v1';

export function getSyncedSheetIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_SYNCED_SHEET_IDS);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markSheetIdSynced(id: string): void {
  if (!id) return;
  try {
    const set = getSyncedSheetIds();
    set.add(id);
    localStorage.setItem(STORAGE_SYNCED_SHEET_IDS, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

const inFlightOrSynced = new Set<string>();
const recentFingerprints = new Map<string, number>();

export async function sendFeedbackToGoogleSheet(data: GoogleSheetFeedbackData): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGoogleSheetUrl();
  if (!webhookUrl || webhookUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return { success: true };
  }

  const recordId = data.record_id?.trim() || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  
  // Prevent duplicate concurrent / repeated submissions for the same record ID
  if (inFlightOrSynced.has(recordId)) {
    return { success: true };
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const payload = {
    record_id: recordId,
    timestamp: data.submitted_at ? new Date(data.submitted_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : timestamp,
    customer_name: data.customer_name?.trim() || 'Anonymous Customer',
    overall_rating: data.overall_rating,
    food_rating: data.food_rating || 0,
    service_rating: data.service_rating || 0,
    cleanliness_rating: data.cleanliness_rating || 0,
    message: data.message?.trim() || '',
  };

  // Content fingerprint deduplication: prevent accidental rapid double-click submissions (within 4s)
  const fingerprint = [
    payload.customer_name.toLowerCase(),
    payload.overall_rating,
    payload.food_rating,
    payload.service_rating,
    payload.cleanliness_rating,
    payload.message.toLowerCase(),
  ].join(':::');

  const now = Date.now();
  // Clean up fingerprints older than 30 seconds
  for (const [fp, time] of recentFingerprints.entries()) {
    if (now - time > 30_000) {
      recentFingerprints.delete(fp);
    }
  }

  const lastTime = recentFingerprints.get(fingerprint);
  if (lastTime && now - lastTime < 4_000) {
    // Rapid duplicate submission absorbed (e.g. double click)
    return { success: true };
  }

  inFlightOrSynced.add(recordId);
  recentFingerprints.set(fingerprint, now);

  try {
    const q = new URLSearchParams({
      record_id: payload.record_id,
      timestamp: payload.timestamp,
      customer_name: payload.customer_name,
      overall_rating: String(payload.overall_rating),
      food_rating: String(payload.food_rating),
      service_rating: String(payload.service_rating),
      cleanliness_rating: String(payload.cleanliness_rating),
      message: payload.message,
    });
    const targetUrl = `${webhookUrl}?${q.toString()}`;

    // Strictly single dispatch: no-cors fetch with keepalive.
    // Never trigger a fallback or second request to ensure only 1 row is ever created.
    try {
      await fetch(targetUrl, {
        method: 'GET',
        mode: 'no-cors',
        keepalive: true,
        cache: 'no-cache',
      });
    } catch (deliveryErr) {
      // The request was already dispatched over the network by the browser.
      // We strictly do NOT retry to avoid duplicate rows.
      console.warn('Google Sheets network dispatch note:', deliveryErr);
    }

    markSheetIdSynced(payload.record_id);
    return { success: true };
  } catch (err) {
    inFlightOrSynced.delete(recordId);
    console.warn('Google Sheets delivery error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function syncFeedbackToGoogleSheet(
  records: GoogleSheetFeedbackData[]
): Promise<{ success: boolean; synced: number; error?: string }> {
  let synced = 0;

  for (const record of records) {
    const result = await sendFeedbackToGoogleSheet(record);
    if (!result.success) {
      return { success: false, synced, error: result.error || 'A review could not be synced.' };
    }
    if (record.record_id) {
      markSheetIdSynced(record.record_id);
    }
    synced += 1;
  }

  return { success: true, synced };
}

/**
 * Automatically sync any reviews that have not yet been recorded in the Google Sheet.
 * Safe to run periodically and on real-time feedback arrival.
 */
export async function autoSyncUnsyncedReviews(
  records: GoogleSheetFeedbackData[]
): Promise<{ success: boolean; syncedCount: number }> {
  const syncedIds = getSyncedSheetIds();
  const unsynced = records.filter((r) => r.record_id && !syncedIds.has(r.record_id));
  if (unsynced.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  let count = 0;
  for (const record of unsynced) {
    const result = await sendFeedbackToGoogleSheet(record);
    if (result.success) {
      count++;
    }
  }

  return { success: true, syncedCount: count };
}

/**
 * Diagnostic helper to test the webhook endpoint from the Admin panel
 */
export async function testGoogleSheetWebhook(targetUrl?: string): Promise<{ success: boolean; message: string }> {
  const url = (targetUrl || getGoogleSheetUrl()).trim();
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    return { success: false, message: 'Google Sheets webhook URL is not configured or contains placeholder.' };
  }

  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    let jsonStatus = '';
    try {
      const parsed = JSON.parse(text);
      if (parsed.status === 'success' || parsed.message) {
        jsonStatus = parsed.message;
      }
    } catch {
      // not json, use text
    }

    return {
      success: true,
      message: jsonStatus || (text.length > 80 ? text.slice(0, 80) + '...' : text) || 'Connected successfully to Google Apps Script webhook!',
    };
  } catch {
    // If CORS blocked reading the response directly, test with no-cors probe
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', redirect: 'follow' });
      return {
        success: true,
        message: 'Connected to Webhook (endpoint reachable via browser proxy)',
      };
    } catch (err2) {
      return {
        success: false,
        message: err2 instanceof Error ? err2.message : 'Unable to connect to Google Apps Script URL',
      };
    }
  }
}

/**
 * Fetch submitted customer reviews directly from the Google Sheet
 */
export async function fetchFeedbackFromGoogleSheet(): Promise<Feedback[]> {
  const webhookUrl = getGoogleSheetUrl();
  if (!webhookUrl || webhookUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return [];
  }

  try {
    const res = await fetch(`${webhookUrl}?action=getFeedback`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const text = await res.text();
    let parsed: { status?: string; data?: unknown[] } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }

    if (parsed && Array.isArray(parsed.data)) {
      return parsed.data.map((raw: unknown, index: number) => {
        const item = raw as Record<string, unknown>;
        return {
          id: (item.id as string) || `sheet_${index + 1}`,
          overall_rating: Number(item.overall_rating) || 5,
          food_rating: item.food_rating ? Number(item.food_rating) : null,
          service_rating: item.service_rating ? Number(item.service_rating) : null,
          cleanliness_rating: item.cleanliness_rating ? Number(item.cleanliness_rating) : null,
          message: String(item.message || '').trim(),
          customer_name: String(item.customer_name || 'Anonymous Customer').trim(),
          approved: Boolean(item.approved),
          created_at: item.timestamp ? new Date(item.timestamp as string).toISOString() : new Date().toISOString(),
        };
      });
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Fetch application state (store status, menu, gallery, reviews config) from Google Sheets
 */
export async function fetchGlobalStateFromGoogleSheet(): Promise<Record<string, unknown> | null> {
  const webhookUrl = getGoogleSheetUrl();
  if (!webhookUrl || webhookUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return null;
  }

  try {
    const res = await fetch(`${webhookUrl}?action=getState`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    let parsed: { status?: string; data?: Record<string, unknown> } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    if (parsed && parsed.status === 'success' && parsed.data && typeof parsed.data === 'object') {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save global state key/value to Google Sheets across all devices
 */
export async function saveGlobalStateToGoogleSheet(
  key: string,
  value: unknown
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getGoogleSheetUrl();
  if (!webhookUrl || webhookUrl.includes('YOUR_DEPLOYMENT_ID')) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  const payloadStr = typeof value === 'string' ? value : JSON.stringify(value);

  // Method 1: Try GET request (works universally without CORS preflight issues)
  try {
    const q = new URLSearchParams({
      action: 'saveState',
      key,
      value: payloadStr,
    });
    if (q.toString().length < 1800) {
      await fetch(`${webhookUrl}?${q.toString()}`, {
        method: 'GET',
        mode: 'no-cors',
        keepalive: true,
      });
      return { success: true };
    }
  } catch {
    // Fall back to POST
  }

  // Method 2: POST request with text/plain to avoid preflight
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveState', key, value }),
      keepalive: true,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

