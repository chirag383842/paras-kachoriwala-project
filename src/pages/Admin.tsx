import { useState, useEffect, useRef } from 'react';
import {
  Lock,
  LogOut,
  Store,
  Users,
  IndianRupee,
  Save,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Clock,
  FileSpreadsheet,
  Image as ImageIcon,
  Upload,
  Plus,
  Calendar,
  Check,
  Star,
  Folder,
  Utensils,
  Camera,
  Video,
  Music,
  Database,
  Copy,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { login, logout, getAuthUser, checkLockout, type AuthUser } from '@/lib/auth';
import {
  useProducts,
  useStoreStatus,
  useFeedbackList,
  useGallery,
  updateStoreStatus,
  updateProduct,
  addProduct,
  deleteProduct,
  deleteFeedback,
  toggleApproveFeedback,
  addGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
  clearAllGalleryImages,
  syncAuthorGalleryToSupabase,
  checkSupabaseHealth,
  type SupabaseHealthStatus,
} from '@/lib/hooks';
import { SUPABASE_SETUP_SQL } from '@/lib/supabaseSyncSql';
import {
  getGoogleSheetUrl,
  setGoogleSheetUrl,
  syncFeedbackToGoogleSheet,
  testGoogleSheetWebhook,
} from '@/lib/googleSheets';
import { CROWD_META, type CrowdLevel, formatTime, getISTDate, isWithinScheduleHours } from '@/lib/constants';
import { GALLERY_CATEGORIES } from '@/lib/galleryData';
import { optimizeImageForProduct, optimizeGalleryMedia } from '@/lib/imageUtils';
import type { Page } from '@/components/Navbar';
import type { GalleryImage, GalleryCategory, Product } from '@/lib/types';
import Logo from '@/components/Logo';
import StarRating from '@/components/StarRating';
import { SectionSkeleton, SectionError } from '@/components/SectionLoader';

type Props = {
  onNavigate: (page: Page) => void;
};

export default function Admin({ onNavigate }: Props) {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Tab State
  const [activeTab, setActiveTab] = useState<'status' | 'products' | 'gallery' | 'feedback'>('status');

  // Status management state
  const { data: storeStatus, computed: storeComputed, error: storeStatusError, refetch: refetchStoreStatus } = useStoreStatus();
  const [, setIsOpen] = useState(true);
  const [crowd, setCrowd] = useState<CrowdLevel>('Moderate');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');

  // Products management state
  const { data: products, error: productsError, refetch: refetchProducts } = useProducts();
  const [productForms, setProductForms] = useState<
    Record<string, { price: number; available: boolean; stock: number; description: string }>
  >({});
  const [productSaving, setProductSaving] = useState<Record<string, boolean>>({});
  const [productMessages, setProductMessages] = useState<Record<string, string>>({});
  const [productImageUploading, setProductImageUploading] = useState<Record<string, boolean>>({});
  const [targetProductForPhoto, setTargetProductForPhoto] = useState<Product | null>(null);
  const productPhotoInputRef = useRef<HTMLInputElement>(null);
  const [activeEditingSlug, setActiveEditingSlug] = useState<string | null>(null);

  // Add Menu Item state
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    dietaryType: 'regular' as 'regular' | 'jain' | 'swaminarayan' | 'special',
    price: 40,
    stock: 50,
    available: true,
    featured: false,
    description: '',
    image_url: '',
  });
  const [newMenuPhotoUploading, setNewMenuPhotoUploading] = useState(false);
  const [isAddingMenu, setIsAddingMenu] = useState(false);
  const [addMenuError, setAddMenuError] = useState('');
  const [addMenuSuccess, setAddMenuSuccess] = useState('');
  const newMenuPhotoInputRef = useRef<HTMLInputElement>(null);

  // Gallery management state
  const { data: galleryImages, loading: loadingGallery, error: galleryError, refetch: refetchGallery } = useGallery();
  const [uploadCategory, setUploadCategory] = useState<GalleryImage['category']>('customers');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadAlt, setUploadAlt] = useState('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewMediaType, setPreviewMediaType] = useState<'image' | 'video' | 'audio'>('image');
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [galleryFilterFolder, setGalleryFilterFolder] = useState<GalleryCategory>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [syncingGallery, setSyncingGallery] = useState(false);
  const [gallerySyncMsg, setGallerySyncMsg] = useState('');

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState(getGoogleSheetUrl());
  const [sheetUrlSaved, setSheetUrlSaved] = useState(false);
  const [syncingReviews, setSyncingReviews] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Cloud Database Real-Time Sync Diagnostic State
  const [cloudHealth, setCloudHealth] = useState<SupabaseHealthStatus | null>(null);
  const [checkingCloudHealth, setCheckingCloudHealth] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  const runCloudHealthCheck = async () => {
    setCheckingCloudHealth(true);
    try {
      const res = await checkSupabaseHealth();
      setCloudHealth(res);
    } catch {
      // ignore
    } finally {
      setCheckingCloudHealth(false);
    }
  };

  useEffect(() => {
    if (user) {
      runCloudHealthCheck();
    }
  }, [user]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 4000);
  };

  // Feedback & Reviews state
  const { data: feedbackList, loading: loadingFeedback, error: feedbackError, refetch: refetchFeedback } = useFeedbackList();
  const [feedbackActionMsg, setFeedbackActionMsg] = useState('');
  const [feedbackActionError, setFeedbackActionError] = useState('');
  const [feedbackActionId, setFeedbackActionId] = useState<string | null>(null);

  // Sync store status state
  useEffect(() => {
    if (storeStatus) {
      setIsOpen(storeStatus.is_open);
      setCrowd((storeStatus.crowd_level as CrowdLevel) || 'Moderate');
    }
  }, [storeStatus]);

  // Background sync author gallery to Supabase on login to ensure parity
  useEffect(() => {
    if (user) {
      syncAuthorGalleryToSupabase().catch(() => {});
    }
  }, [user]);

  // Sync products form state from Supabase
  useEffect(() => {
    if (products && products.length > 0) {
      setProductForms((prev) => {
        const next = { ...prev };
        products.forEach((p) => {
          const isCurrentlyEditing = activeEditingSlug === p.slug || activeEditingSlug === p.id;
          const existing = prev[p.slug] ?? prev[p.id];
          const entry = {
            price: isCurrentlyEditing && existing?.price !== undefined ? existing.price : p.price,
            available: p.available,
            stock: isCurrentlyEditing && existing?.stock !== undefined ? existing.stock : (p.stock ?? 0),
            description:
              isCurrentlyEditing && existing?.description !== undefined
                ? existing.description
                : p.description,
          };
          next[p.slug] = entry;
          next[p.id] = entry;
        });
        return next;
      });
    }
  }, [products, activeEditingSlug]);

  // Check rate limit timer
  useEffect(() => {
    const lock = checkLockout();
    if (lock.isLocked) {
      setLockoutSeconds(lock.remainingSeconds);
    }
  }, []);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setLoginError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Listen for auth state changes
  useEffect(() => {
    const checkAuth = () => {
      setUser(getAuthUser());
    };
    window.addEventListener('pk_auth_state_changed', checkAuth);
    return () => window.removeEventListener('pk_auth_state_changed', checkAuth);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setIsLoggingIn(true);
    setLoginError('');

    const res = await login(email, password);
    if (res.success && res.user) {
      setUser(res.user);
      setLoginError('');
    } else {
      setLoginError(res.error ?? 'Invalid email address or password.');
      if (res.remainingSeconds) {
        setLockoutSeconds(res.remainingSeconds);
      }
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  // 1. Store Status Actions
  const handleForceOpenNow = async () => {
    if (
      !confirm(
        'Open the stall now for today? The store will be marked OPEN immediately. The regular daily schedule (7:30 PM – 12:00 AM IST) will resume tomorrow automatically.'
      )
    ) {
      return;
    }
    setStatusSaving(true);
    setStatusMessage('');
    setStatusError('');

    const ist = getISTDate();
    const res = await updateStoreStatus({
      is_open: true,
      crowd_level: crowd,
      force_open_date: ist.dateString,
      closed_for_date: null,
      override_mode: 'force_open',
    });

    if (res.success) {
      setIsOpen(true);
      if (res.rlsBlocked) {
        setStatusError('⚠️ Changed locally on this device, but NOT synced to other customer phones! Supabase RLS is blocking remote updates. Click "View SQL" above to run the 1-click fix in Supabase.');
        void runCloudHealthCheck();
      } else {
        setStatusMessage(
          'Stall is now OPEN for today! Next day it will automatically follow the daily 7:30 PM – 12:00 AM schedule.'
        );
        setTimeout(() => setStatusMessage(''), 5000);
      }
    } else {
      setStatusError(res.error ?? 'Unable to publish store status.');
    }
    setStatusSaving(false);
  };

  const handleForceCloseNow = async () => {
    if (
      !confirm(
        'Close the stall now? The store will be marked CLOSED for the rest of today, and will automatically reopen tomorrow according to the normal daily schedule (7:30 PM IST).'
      )
    ) {
      return;
    }
    setStatusSaving(true);
    setStatusMessage('');
    setStatusError('');

    const ist = getISTDate();
    const res = await updateStoreStatus({
      is_open: false,
      crowd_level: crowd,
      force_open_date: null,
      closed_for_date: ist.dateString,
      override_mode: 'closed_now',
    });

    if (res.success) {
      setIsOpen(false);
      if (res.rlsBlocked) {
        setStatusError('⚠️ Changed locally on this device, but NOT synced to other customer phones! Supabase RLS is blocking remote updates. Click "View SQL" above to run the 1-click fix in Supabase.');
        void runCloudHealthCheck();
      } else {
        setStatusMessage(
          `Stall marked CLOSED for today (${ist.dateString}). Tomorrow it will automatically reopen per normal schedule (7:30 PM – 12:00 AM IST).`
        );
        setTimeout(() => setStatusMessage(''), 6000);
      }
    } else {
      setStatusError(res.error ?? 'Unable to publish store status.');
    }
    setStatusSaving(false);
  };

  const handleCloseShopForToday = async () => {
    if (
      !confirm(
        'Are you sure you want to close the shop for today? It will automatically reopen tomorrow according to the normal schedule (7:30 PM IST).'
      )
    ) {
      return;
    }

    setStatusSaving(true);
    setStatusMessage('');
    setStatusError('');

    const ist = getISTDate();
    const res = await updateStoreStatus({
      is_open: false,
      crowd_level: 'Low',
      closed_for_date: ist.dateString,
      force_open_date: null,
      override_mode: 'closed_today',
    });

    if (res.success) {
      setIsOpen(false);
      if (res.rlsBlocked) {
        setStatusError('⚠️ Changed locally on this device, but NOT synced to other customer phones! Supabase RLS is blocking remote updates. Click "View SQL" above to run the 1-click fix in Supabase.');
        void runCloudHealthCheck();
      } else {
        setStatusMessage(
          `Shop closed for today (${ist.dateString}). The system will automatically reset tomorrow at 7:30 PM IST.`
        );
        setTimeout(() => setStatusMessage(''), 5000);
      }
    } else {
      setStatusError(res.error ?? 'Unable to close the shop for today. Please try again.');
    }
    setStatusSaving(false);
  };

  const handleResumeSchedule = async () => {
    setStatusSaving(true);
    setStatusMessage('');
    setStatusError('');

    const nowWithinSchedule = isWithinScheduleHours();
    const res = await updateStoreStatus({
      is_open: nowWithinSchedule,
      crowd_level: crowd,
      closed_for_date: null,
      force_open_date: null,
      override_mode: null,
    });

    if (res.success) {
      setIsOpen(nowWithinSchedule);
      if (res.rlsBlocked) {
        setStatusError('⚠️ Changed locally on this device, but NOT synced to other customer phones! Supabase RLS is blocking remote updates. Click "View SQL" above to run the 1-click fix in Supabase.');
        void runCloudHealthCheck();
      } else {
        setStatusMessage(
          `Overrides cleared! Store is now following the real-time automatic schedule (7:30 PM – 12:00 AM daily). Currently ${nowWithinSchedule ? 'OPEN' : 'CLOSED'}.`
        );
        setTimeout(() => setStatusMessage(''), 5000);
      }
    } else {
      setStatusError(res.error ?? 'Unable to update store status.');
    }
    setStatusSaving(false);
  };

  const handleSaveCrowdLevel = async () => {
    setStatusSaving(true);
    setStatusMessage('');
    setStatusError('');

    const ist = getISTDate();
    const isTodayOpenOverride = storeStatus?.force_open_date === ist.dateString;
    const isTodayClosedOverride = storeStatus?.closed_for_date === ist.dateString;

    const res = await updateStoreStatus({
      is_open: storeComputed.isOpen,
      crowd_level: crowd,
      closed_for_date: isTodayClosedOverride ? ist.dateString : null,
      force_open_date: isTodayOpenOverride ? ist.dateString : null,
      override_mode: storeStatus?.override_mode ?? null,
    });

    if (res.success) {
      if (res.rlsBlocked) {
        setStatusError('⚠️ Changed locally on this device, but NOT synced to other customer phones! Supabase RLS is blocking remote updates. Click "View SQL" above to run the 1-click fix in Supabase.');
        void runCloudHealthCheck();
      } else {
        setStatusMessage(`Live crowd meter updated to "${crowd}"!`);
        setTimeout(() => setStatusMessage(''), 4000);
      }
    } else {
      setStatusError(res.error ?? 'Unable to update crowd level.');
    }
    setStatusSaving(false);
  };

  // 2. Product Availability Toggle & Save Actions
  const handleToggleAvailability = async (product: Product, newAvailable: boolean) => {
    const currentForm = productForms[product.slug] ?? productForms[product.id] ?? {
      price: product.price,
      available: product.available,
      stock: product.stock ?? 0,
      description: product.description,
    };

    const priceToSave = Number(currentForm.price || product.price);
    const updatedEntry = {
      ...currentForm,
      price: priceToSave,
      available: newAvailable,
    };

    // 1. Immediately update local UI state in 0ms (no lag, no waiting)
    setProductForms((prev) => ({
      ...prev,
      [product.slug]: updatedEntry,
      [product.id]: updatedEntry,
    }));

    // 2. Save to Supabase first — the database is the single source of truth.
    const res = await updateProduct(
      product.id,
      {
        available: newAvailable,
        price: priceToSave,
        stock: Number(currentForm.stock ?? 0),
        description: currentForm.description,
      },
      product.slug
    );

    if (res.success) {
      void refetchProducts();
      // 3. Only report success once the database confirmed the change.
      const liveMsg = newAvailable
        ? `Live Website: ${product.name} is now marked IN STOCK!`
        : `Live Website: ${product.name} is now marked SOLD OUT!`;
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: liveMsg,
        [product.id]: liveMsg,
      }));
    } else {
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: `⚠ Update failed: ${res.error || 'Please try again'}`,
        [product.id]: `⚠ Update failed: ${res.error || 'Please try again'}`,
      }));
    }
    setTimeout(() => {
      setProductMessages((prev) => ({ ...prev, [product.slug]: '', [product.id]: '' }));
    }, 4000);
  };

  const handleSaveProduct = async (product: Product) => {
    const form = productForms[product.slug] ?? productForms[product.id] ?? {
      price: product.price,
      available: product.available,
      stock: product.stock ?? 0,
      description: product.description,
    };

    setProductSaving((prev) => ({ ...prev, [product.slug]: true, [product.id]: true }));
    setProductMessages((prev) => ({ ...prev, [product.slug]: '', [product.id]: '' }));

    const res = await updateProduct(
      product.id,
      {
        price: Number(form.price),
        available: form.available,
        stock: Number(form.stock ?? product?.stock ?? 0),
        description: form.description,
      },
      product.slug
    );

    if (res.success) {
      void refetchProducts();
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: `✓ Price & details for ${product.name} updated live across all devices!`,
        [product.id]: `✓ Price & details for ${product.name} updated live across all devices!`,
      }));
      setTimeout(() => {
        setProductMessages((prev) => ({ ...prev, [product.slug]: '', [product.id]: '' }));
      }, 3500);
    } else {
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: `⚠ Update failed: ${res.error || 'Please try again'}`,
        [product.id]: `⚠ Update failed: ${res.error || 'Please try again'}`,
      }));
    }

    setProductSaving((prev) => ({ ...prev, [product.slug]: false, [product.id]: false }));
  };

  const handleQuickPriceSave = async (product: Product, specificPrice?: number) => {
    const form = productForms[product.slug] ?? productForms[product.id] ?? {
      price: product.price,
      available: product.available,
      stock: product.stock ?? 0,
      description: product.description,
    };

    const priceToSave = specificPrice !== undefined ? specificPrice : Number(form.price);
    if (isNaN(priceToSave) || priceToSave <= 0) return;

    // 1. Immediately update local state in 0ms
    const updatedEntry = {
      ...form,
      price: priceToSave,
    };
    setProductForms((prev) => ({
      ...prev,
      [product.slug]: updatedEntry,
      [product.id]: updatedEntry,
    }));

    // 2. Show confirmation banner
    const priceMsg = `Updating ${product.name} price to ₹${priceToSave}...`;
    setProductMessages((prev) => ({
      ...prev,
      [product.slug]: priceMsg,
      [product.id]: priceMsg,
    }));

    // 3. Save to Supabase first — the database is the single source of truth.
    const res = await updateProduct(
      product.id,
      {
        price: priceToSave,
        available: form.available,
        stock: Number(form.stock ?? 0),
        description: form.description,
      },
      product.slug
    );

    if (res.success) {
      void refetchProducts();
      const successMsg = `✓ Live: ${product.name} price saved to ₹${priceToSave} & updated across all devices!`;
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: successMsg,
        [product.id]: successMsg,
      }));
    } else {
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: `⚠ Update failed: ${res.error || 'Please try again'}`,
        [product.id]: `⚠ Update failed: ${res.error || 'Please try again'}`,
      }));
    }
    setTimeout(() => {
      setProductMessages((prev) => ({ ...prev, [product.slug]: '', [product.id]: '' }));
    }, 3500);
  };

  const handleTriggerProductPhotoUpload = (product: Product) => {
    setTargetProductForPhoto(product);
    if (productPhotoInputRef.current) {
      productPhotoInputRef.current.value = '';
      productPhotoInputRef.current.click();
    }
  };

  const handleProductPhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetProductForPhoto) return;

    const target = targetProductForPhoto;

    setProductImageUploading((prev) => ({
      ...prev,
      [target.slug]: true,
      [target.id]: true,
    }));

    try {
      // Optimize image to ~40-70KB WebP/JPEG max 800px so it loads instantly and fits storage
      const optimizedDataUrl = await optimizeImageForProduct(file, 800, 0.85);

      const res = await updateProduct(
        target.id,
        {
          image_url: optimizedDataUrl,
        },
        target.slug
      );

      if (res.success) {
        void refetchProducts();
        setProductMessages((prev) => ({
          ...prev,
          [target.slug]: `Photo for ${target.name} updated live across entire website!`,
          [target.id]: `Photo for ${target.name} updated live across entire website!`,
        }));
        setTimeout(() => {
          setProductMessages((prev) => ({ ...prev, [target.slug]: '', [target.id]: '' }));
        }, 4000);
      } else {
        alert(res.error || 'Failed to update product photo.');
      }
    } catch (err) {
      console.error('Error optimizing product photo:', err);
      const msg = err instanceof Error && err.message ? err.message : 'Please try another photo.';
      alert('Could not process photo: ' + msg);
    } finally {
      setProductImageUploading((prev) => ({
        ...prev,
        [target.slug]: false,
        [target.id]: false,
      }));
      if (productPhotoInputRef.current) {
        productPhotoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveProductPhoto = async (product: Product) => {
    if (
      !confirm(
        `Are you sure you want to remove the photo for ${product.name}? It will revert to the default illustration on the website.`
      )
    ) {
      return;
    }

    setProductImageUploading((prev) => ({
      ...prev,
      [product.slug]: true,
      [product.id]: true,
    }));

    const res = await updateProduct(
      product.id,
      {
        image_url: '',
      },
      product.slug
    );

    if (res.success) {
      void refetchProducts();
      setProductMessages((prev) => ({
        ...prev,
        [product.slug]: `Photo removed for ${product.name}. Default icon will be shown.`,
        [product.id]: `Photo removed for ${product.name}. Default icon will be shown.`,
      }));
      setTimeout(() => {
        setProductMessages((prev) => ({ ...prev, [product.slug]: '', [product.id]: '' }));
      }, 4000);
    }

    setProductImageUploading((prev) => ({
      ...prev,
      [product.slug]: false,
      [product.id]: false,
    }));
  };

  const handleNewMenuPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewMenuPhotoUploading(true);
    try {
      const optimized = await optimizeImageForProduct(file, 800, 0.85);
      setNewMenuItem((prev) => ({ ...prev, image_url: optimized }));
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Please try another photo.';
      alert('Could not process photo: ' + msg);
    } finally {
      setNewMenuPhotoUploading(false);
      if (newMenuPhotoInputRef.current) newMenuPhotoInputRef.current.value = '';
    }
  };

  const handleAddNewMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuItem.name.trim()) {
      setAddMenuError('Please enter a name for the new menu item.');
      return;
    }
    const priceVal = Number(newMenuItem.price);
    if (!priceVal || priceVal <= 0) {
      setAddMenuError('Price must be greater than ₹0.');
      return;
    }

    setIsAddingMenu(true);
    setAddMenuError('');
    setAddMenuSuccess('');

    try {
      let slugBase = newMenuItem.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!slugBase) {
        slugBase = `item-${Date.now()}`;
      }
      if (newMenuItem.dietaryType === 'jain' && !slugBase.includes('jain')) {
        slugBase = `${slugBase}-jain`;
      } else if (newMenuItem.dietaryType === 'swaminarayan' && !slugBase.includes('swaminarayan')) {
        slugBase = `${slugBase}-swaminarayan`;
      }

      const res = await addProduct({
        name: newMenuItem.name.trim(),
        slug: slugBase,
        price: priceVal,
        description:
          newMenuItem.description.trim() ||
          (newMenuItem.dietaryType === 'jain'
            ? 'Prepared strictly per Jain dietary traditions without onion or garlic.'
            : newMenuItem.dietaryType === 'swaminarayan'
            ? 'Pure satvik preparation crafted strictly following Swaminarayan traditions.'
            : 'Freshly prepared daily specialty with authentic house chutneys.'),
        image_url: newMenuItem.image_url || '/images/kachori.webp',
        available: newMenuItem.available,
        stock: Number(newMenuItem.stock) || 50,
        featured: newMenuItem.featured,
        display_order: (products?.length ?? 4) + 1,
      });

      if (res.success && res.data) {
        const added = res.data;
        setAddMenuSuccess(`✓ "${added.name}" has been added live to the menu!`);
        setProductForms((prev) => ({
          ...prev,
          [added.slug]: {
            price: added.price,
            available: added.available,
            stock: added.stock ?? 50,
            description: added.description,
          },
          [added.id]: {
            price: added.price,
            available: added.available,
            stock: added.stock ?? 50,
            description: added.description,
          },
        }));

        setNewMenuItem({
          name: '',
          dietaryType: 'regular',
          price: 40,
          stock: 50,
          available: true,
          featured: false,
          description: '',
          image_url: '',
        });

        refetchProducts();

        setTimeout(() => {
          setShowAddMenuModal(false);
          setAddMenuSuccess('');
        }, 1500);
      } else {
        setAddMenuError(res.error || 'Unable to add menu item. Please try again.');
      }
    } catch (err) {
      setAddMenuError(err instanceof Error && err.message ? err.message : 'Error processing menu addition.');
    } finally {
      setIsAddingMenu(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (
      !confirm(
        `Are you sure you want to delete "${product.name}"? It will be removed from the author panel and website menu.`
      )
    ) {
      return;
    }
    const res = await deleteProduct(product.id || product.slug);
    if (res.success) {
      refetchProducts();
    } else {
      alert(res.error || 'Failed to delete this product from the database. Please try again.');
    }
  };

  // 3. Gallery File Validation & Upload Actions (Supports Images, Videos MP4/WebM, Audio MP3/WAV)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    setUploadSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo =
      file.type.startsWith('video/') ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.webm');
    const isAudio =
      file.type.startsWith('audio/') ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isAudio && !isImage) {
      setUploadError(
        'Invalid file type. Supported formats: Images (JPEG, PNG, WebP), Videos (MP4, WebM), Audio (MP3, WAV).'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MAX_SIZE = isVideo || isAudio ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError(
        isVideo || isAudio
          ? 'Media file is too large. Maximum size for video/audio is 25MB.'
          : 'Image file is too large. Maximum size is 10MB.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const mediaType: 'image' | 'video' | 'audio' = isVideo ? 'video' : isAudio ? 'audio' : 'image';
    setPreviewMediaType(mediaType);
    if (isVideo || isAudio) {
      setUploadCategory('videos');
    }

    try {
      const dataUrl = await optimizeGalleryMedia(file);
      setPreviewDataUrl(dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        setPreviewDataUrl(loadEvt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewDataUrl) {
      setUploadError('Please select a photo or video from your device to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    const categoryObj = GALLERY_CATEGORIES.find((c) => c.id === uploadCategory);
    const sectionName = categoryObj ? categoryObj.label : uploadCategory;

    const res = await addGalleryImage({
      src: previewDataUrl,
      alt: uploadAlt || uploadCaption || `${sectionName} media - Paras Kachoriwala`,
      category: uploadCategory,
      media_type: previewMediaType,
      caption: uploadCaption || `${sectionName}`,
    });

    if (res.success) {
      await syncAuthorGalleryToSupabase();
      setUploadSuccess(`Media uploaded and published across all devices to "${sectionName}" folder!`);
      setPreviewDataUrl(null);
      setUploadCaption('');
      setUploadAlt('');
      setPreviewMediaType('image');
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetchGallery();
      setTimeout(() => setUploadSuccess(''), 4500);
    } else {
      setUploadError(res.error ?? 'Failed to upload media.');
    }
    setIsUploading(false);
  };

  const handleDeleteGalleryImage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this photo from the website gallery?')) return;
    const res = await deleteGalleryImage(id);
    if (!res.success) {
      alert(res.error || 'Failed to delete this media from the database. Please try again.');
      return;
    }
    await syncAuthorGalleryToSupabase();
    refetchGallery();
  };

  const handleClearAllGallery = async () => {
    if (
      !confirm(
        '⚠️ Are you sure you want to DELETE ALL images and videos from the gallery?\n\nThis will completely reset the gallery to a clean slate across all customer devices.'
      )
    )
      return;
    setSyncingGallery(true);
    setGallerySyncMsg('');
    const res = await clearAllGalleryImages();
    setSyncingGallery(false);
    if (!res.success) {
      setGallerySyncMsg(`Error: ${res.error || 'Could not clear the gallery. Please try again.'}`);
      setTimeout(() => setGallerySyncMsg(''), 6000);
      return;
    }
    setGallerySyncMsg('All gallery items deleted successfully. Gallery is now a clean slate!');
    setTimeout(() => setGallerySyncMsg(''), 5000);
    refetchGallery();
  };

  const handleSyncGalleryToCloud = async () => {
    setSyncingGallery(true);
    setGallerySyncMsg('');
    const res = await syncAuthorGalleryToSupabase();
    setSyncingGallery(false);
    if (res.success) {
      setGallerySyncMsg(`All devices in sync! (${res.syncedCount} media items published to cloud)`);
      setTimeout(() => setGallerySyncMsg(''), 4500);
      refetchGallery();
    } else {
      setGallerySyncMsg(`Notice: ${res.error || 'Cloud sync completed'}`);
      setTimeout(() => setGallerySyncMsg(''), 4500);
    }
  };

  const handleTriggerReplace = (id: string) => {
    setReplacingId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingId) return;

    const isVideo =
      file.type.startsWith('video/') ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.webm');
    const isAudio =
      file.type.startsWith('audio/') ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isAudio && !isImage) {
      alert('Invalid file format. Please choose a Photo (JPEG, PNG, WebP), Video (MP4, WebM), or Audio (MP3).');
      return;
    }
    const maxBytes = isVideo || isAudio ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(isVideo || isAudio ? 'Media is too large (max 25MB).' : 'Photo is too large (max 10MB).');
      return;
    }

    try {
      const dataUrl = await optimizeGalleryMedia(file);
      const mediaType: 'image' | 'video' | 'audio' = isVideo ? 'video' : isAudio ? 'audio' : 'image';
      const res = await updateGalleryImage(replacingId, { src: dataUrl, media_type: mediaType });
      if (!res.success) {
        alert(res.error || 'Failed to replace this media in the database. Please try again.');
        setReplacingId(null);
        return;
      }
      await syncAuthorGalleryToSupabase();
      refetchGallery();
      setReplacingId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    } catch {
      const reader = new FileReader();
      reader.onload = async (loadEvt) => {
        const dataUrl = loadEvt.target?.result as string;
        const mediaType: 'image' | 'video' | 'audio' = isVideo ? 'video' : isAudio ? 'audio' : 'image';
        const res = await updateGalleryImage(replacingId, { src: dataUrl, media_type: mediaType });
        if (!res.success) {
          alert(res.error || 'Failed to replace this media in the database. Please try again.');
          setReplacingId(null);
          return;
        }
        await syncAuthorGalleryToSupabase();
        refetchGallery();
        setReplacingId(null);
        if (replaceInputRef.current) replaceInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangeImageCategory = async (id: string, newCategory: GalleryImage['category']) => {
    const res = await updateGalleryImage(id, { category: newCategory });
    if (!res.success) {
      alert(res.error || 'Failed to update this media in the database. Please try again.');
      return;
    }
    await syncAuthorGalleryToSupabase();
    refetchGallery();
  };

  // 4. Feedback & Reviews Actions
  const handleToggleApprove = async (id: string, currentApproved: boolean) => {
    setFeedbackActionId(id);
    setFeedbackActionMsg('');
    setFeedbackActionError('');
    const res = await toggleApproveFeedback(id, !currentApproved);
    if (res.success) {
      setFeedbackActionMsg(
        !currentApproved
          ? 'Review is now FEATURED live on the website homepage!'
          : 'Review removed from homepage display.'
      );
      refetchFeedback();
      setTimeout(() => setFeedbackActionMsg(''), 3500);
    } else {
      setFeedbackActionError(res.error ?? 'Could not update this review. Please try again.');
    }
    setFeedbackActionId(null);
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this customer review?')) return;
    setFeedbackActionId(id);
    setFeedbackActionMsg('');
    setFeedbackActionError('');
    const res = await deleteFeedback(id);
    if (res.success) {
      setFeedbackActionMsg('Customer review deleted.');
      refetchFeedback();
      setTimeout(() => setFeedbackActionMsg(''), 3500);
    } else {
      setFeedbackActionError(res.error ?? 'Could not delete this review. Please try again.');
    }
    setFeedbackActionId(null);
  };

  const handleSaveSheetUrl = async () => {
    setGoogleSheetUrl(sheetUrl);
    setSyncingReviews(true);
    const syncResult = await syncFeedbackToGoogleSheet(
      (feedbackList ?? []).map((feedback) => ({
        record_id: feedback.id,
        customer_name: feedback.customer_name ?? undefined,
        overall_rating: feedback.overall_rating,
        food_rating: feedback.food_rating ?? undefined,
        service_rating: feedback.service_rating ?? undefined,
        cleanliness_rating: feedback.cleanliness_rating ?? undefined,
        message: feedback.message ?? undefined,
        submitted_at: feedback.created_at,
      }))
    );
    setSyncingReviews(false);
    setSheetUrlSaved(true);
    setFeedbackActionError(syncResult.success ? '' : syncResult.error ?? 'Some reviews could not be synced.');
    setFeedbackActionMsg(
      syncResult.success
        ? `${syncResult.synced} review${syncResult.synced === 1 ? '' : 's'} synced. Existing reviews were skipped automatically.`
        : `Synced ${syncResult.synced} review${syncResult.synced === 1 ? '' : 's'}, but some reviews failed.`
    );
    setTimeout(() => setSheetUrlSaved(false), 3500);
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setWebhookTestResult(null);
    const result = await testGoogleSheetWebhook(sheetUrl);
    setWebhookTestResult(result);
    setTestingWebhook(false);
  };

  // ----------------------------------------------------
  // RENDER: LOGIN FORM
  // ----------------------------------------------------
  if (!user) {
    return (
      <div className="pt-24 sm:pt-28 pb-16 min-h-[85vh] flex items-center justify-center container-max">
        <div className="card max-w-md w-full p-8 sm:p-10 shadow-warm animate-scale-in">
          <div className="text-center">
            <div className="flex justify-center">
              <Logo size="md" />
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-spice-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-spice-700">
              <ShieldCheck size={14} />
              Author Access Portal
            </div>
            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-charcoal-900">
              Author / Owner Sign-In
            </h1>
            <p className="mt-2 text-sm text-charcoal-600">
              Sign in with your authorized author email to manage store status, gallery photos, and reviews.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-5" noValidate>
            {loginError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-medium text-red-700 flex items-start gap-2 animate-shake">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {lockoutSeconds > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-800 flex items-center gap-2">
                <Clock size={16} className="shrink-0" />
                <span>Security cooldown active. Retry in {lockoutSeconds} seconds.</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Author Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-spice-200 bg-spice-50/50 px-4 py-3 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-spice-500 focus:bg-white transition-colors"
                autoComplete="email"
                disabled={lockoutSeconds > 0}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-spice-200 bg-spice-50/50 px-4 py-3 pr-11 text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:border-spice-500 focus:bg-white transition-colors"
                  autoComplete="current-password"
                  disabled={lockoutSeconds > 0}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || lockoutSeconds > 0}
              className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2 shadow-warm disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Verifying Security...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Login to Author Dashboard
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="btn-outline w-full py-2.5 text-xs text-charcoal-600 border-charcoal-200 hover:bg-charcoal-50"
            >
              ← Back to Main Website
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: AUTHOR CONTROL PANEL
  // ----------------------------------------------------
  const istDate = getISTDate();
  const isClosedForToday = storeComputed.isClosedForToday;

  // Folder helper list for gallery (Exactly 4 folders)
  const folderCategories = [
    { id: 'customers', label: 'Customers / Community Section', icon: <Users size={16} />, desc: 'Happy customers & foodies' },
    { id: 'stall', label: 'Stall / Cart Location', icon: <Store size={16} />, desc: 'Food cart, night stall & setup' },
    { id: 'food', label: 'Food / Menu Section', icon: <Utensils size={16} />, desc: 'Kachori, Bhel & delicious ingredients' },
    { id: 'videos', label: 'Videos & Clips (MP4/MP3)', icon: <Video size={16} />, desc: 'Videos, reels and audio clips' },
  ] as const;

  const filteredGallery = (galleryImages ?? []).filter((img) => {
    if (galleryFilterFolder === 'all') return true;
    if (galleryFilterFolder === 'stall') {
      return img.category === 'stall' || (img.category as string) === 'shop' || (img.category as string) === 'home' || (img.category as string) === 'about';
    }
    return img.category === galleryFilterFolder;
  });

  return (
    <div className="pt-20 sm:pt-24 pb-20 bg-spice-50/40 min-h-screen">
      {/* Hidden input for replacing image */}
      <input
        type="file"
        ref={replaceInputRef}
        onChange={handleReplaceFile}
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
      />

      <div className="container-max py-8">
        {/* Author Header Bar */}
        <div className="card p-6 sm:p-8 bg-charcoal-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-warm">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-500/20 border border-leaf-500/40 px-3 py-1 text-xs font-bold text-leaf-300">
                <ShieldCheck size={14} /> Author Verified
              </span>
              <span className="text-xs text-spice-200/70">
                Timezone: IST (UTC+5:30) • {istDate.dayName}, {istDate.dateString}
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold">Author Management Portal</h1>
            <p className="mt-1 text-sm text-spice-100/70">
              Welcome, <span className="font-semibold text-marigold-300">{user.name}</span> ({user.email})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('home')}
              className="btn bg-white/10 text-white hover:bg-white/20 text-xs py-2.5 px-4 flex items-center gap-2 border border-white/20"
            >
              View Live Website
              <ArrowRight size={14} />
            </button>
            <button
              onClick={handleLogout}
              className="btn bg-red-500/20 text-red-200 hover:bg-red-500/30 text-xs py-2.5 px-4 flex items-center gap-1.5 border border-red-500/30"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>

        {/* Real-Time Multi-Device Cloud Sync Health Bar */}
        {cloudHealth && !cloudHealth.isHealthy && (
          <div className="mt-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 p-5 sm:p-6 text-charcoal-900 shadow-md animate-fade-up">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm mt-0.5">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-amber-950">
                      Cross-Device Sync Setup Required
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                      Changes only saving locally on this device
                    </span>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-amber-900/90 leading-relaxed max-w-3xl">
                    Edits made here are currently saved only in your local browser cache because Supabase database write policies are not yet active. Run the 1-click SQL script below in your Supabase SQL editor to enable instant, real-time sync across all customer phones and devices.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${cloudHealth.storeStatusWritable ? 'bg-leaf-100 text-leaf-800' : 'bg-red-100 text-red-800'}`}>
                      {cloudHealth.storeStatusWritable ? '✓ Store Status Writable' : '✗ Store Status Blocked (RLS)'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${cloudHealth.productsWritable ? 'bg-leaf-100 text-leaf-800' : 'bg-red-100 text-red-800'}`}>
                      {cloudHealth.productsWritable ? '✓ Products Writable' : '✗ Products Blocked (RLS)'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${cloudHealth.galleryTableExists ? 'bg-leaf-100 text-leaf-800' : 'bg-red-100 text-red-800'}`}>
                      {cloudHealth.galleryTableExists ? '✓ Gallery Table Ready' : '✗ Gallery Table Missing'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 ${cloudHealth.feedbackWritable ? 'bg-leaf-100 text-leaf-800' : 'bg-red-100 text-red-800'}`}>
                      {cloudHealth.feedbackWritable ? '✓ Customer Reviews Writable' : '✗ Customer Reviews Blocked (RLS)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap md:flex-col items-stretch gap-2 shrink-0">
                <button
                  onClick={handleCopySql}
                  className="btn bg-amber-600 hover:bg-amber-700 text-white text-xs py-2.5 px-4 font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  {sqlCopied ? <Check size={15} /> : <Copy size={15} />}
                  {sqlCopied ? 'SQL Copied to Clipboard!' : '1. Copy SQL Fix'}
                </button>
                <a
                  href="https://supabase.com/dashboard/project/xrvdohzqdzcunqshgqoz/sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-charcoal-900 hover:bg-charcoal-800 text-white text-xs py-2.5 px-4 font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <ExternalLink size={15} />
                  2. Open Supabase SQL Editor
                </a>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runCloudHealthCheck}
                    disabled={checkingCloudHealth}
                    className="btn bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs py-2 px-3 font-semibold flex-1 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={13} className={checkingCloudHealth ? 'animate-spin' : ''} />
                    {checkingCloudHealth ? 'Verifying...' : '3. Re-verify Sync'}
                  </button>
                  <button
                    onClick={() => setShowSqlModal(true)}
                    className="btn bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 text-xs py-2 px-3 font-semibold flex items-center justify-center gap-1"
                  >
                    View SQL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {cloudHealth && cloudHealth.isHealthy && (
          <div className="mt-6 rounded-2xl bg-leaf-500/10 border border-leaf-500/30 p-4 sm:p-5 text-charcoal-900 flex items-center justify-between gap-4 animate-fade-up">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-600 text-white shadow-sm">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <p className="text-sm font-bold text-leaf-950 flex items-center gap-2">
                  <span>Real-Time Multi-Device Sync Active</span>
                  <span className="h-2 w-2 rounded-full bg-leaf-500 animate-pulse" />
                </p>
                <p className="text-xs text-leaf-800 mt-0.5">
                  All store status overrides, menu price/stock adjustments, and gallery media are synced live to all customer devices via WebSockets.
                </p>
              </div>
            </div>
            <button
              onClick={runCloudHealthCheck}
              disabled={checkingCloudHealth}
              title="Refresh connection status"
              className="p-2 text-leaf-700 hover:bg-leaf-100 rounded-xl transition-colors shrink-0"
            >
              <RefreshCw size={16} className={checkingCloudHealth ? 'animate-spin' : ''} />
            </button>
          </div>
        )}

        {/* SQL Preview Modal */}
        {showSqlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between border-b border-spice-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <Database size={20} className="text-spice-600" />
                  <h3 className="font-display font-bold text-lg text-charcoal-900">
                    Supabase Database Real-Time Setup SQL
                  </h3>
                </div>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="p-2 rounded-xl text-charcoal-500 hover:bg-spice-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-charcoal-600 mt-3">
                Copy and paste this script into your Supabase SQL Editor (
                <a
                  href="https://supabase.com/dashboard/project/xrvdohzqdzcunqshgqoz/sql"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-spice-600 underline font-semibold"
                >
                  open editor
                </a>
                ) and click &quot;Run&quot;. This enables instant real-time sync across all customer phones!
              </p>

              <pre className="mt-4 flex-1 overflow-auto bg-charcoal-950 text-spice-100 p-4 rounded-2xl text-xs font-mono leading-relaxed border border-charcoal-800">
                {SUPABASE_SETUP_SQL}
              </pre>

              <div className="mt-5 pt-4 border-t border-spice-200 flex justify-end gap-3">
                <button
                  onClick={handleCopySql}
                  className="btn bg-spice-600 hover:bg-spice-700 text-white text-xs py-2.5 px-5 font-bold flex items-center gap-2 shadow-sm"
                >
                  {sqlCopied ? <Check size={15} /> : <Copy size={15} />}
                  {sqlCopied ? 'Copied to Clipboard!' : 'Copy Entire SQL Script'}
                </button>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="btn bg-spice-100 hover:bg-spice-200 text-charcoal-800 text-xs py-2.5 px-5 font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 border-b border-spice-200 pb-4">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'status'
                ? 'bg-spice-600 text-white shadow-warm'
                : 'bg-white text-charcoal-700 border border-spice-200 hover:bg-spice-50'
            }`}
          >
            <Store size={17} />
            Store Status & Schedule
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'products'
                ? 'bg-spice-600 text-white shadow-warm'
                : 'bg-white text-charcoal-700 border border-spice-200 hover:bg-spice-50'
            }`}
          >
            <Utensils size={17} />
            Menu & Prices
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'gallery'
                ? 'bg-spice-600 text-white shadow-warm'
                : 'bg-white text-charcoal-700 border border-spice-200 hover:bg-spice-50'
            }`}
          >
            <ImageIcon size={17} />
            Gallery & Folders ({galleryImages?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'feedback'
                ? 'bg-spice-600 text-white shadow-warm'
                : 'bg-white text-charcoal-700 border border-spice-200 hover:bg-spice-50'
            }`}
          >
            <MessageSquare size={17} />
            Customer Reviews ({feedbackList?.length ?? 0})
          </button>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TAB 1: STORE STATUS & AUTOMATIC NEXT-DAY OPENING */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'status' && (
          <div className="mt-8 grid gap-8 lg:grid-cols-12 animate-fade-up">
            <div className="lg:col-span-8 space-y-5">
              {storeStatusError && (
                <SectionError
                  title="Unable to load store status."
                  message={storeStatusError}
                  onRetry={refetchStoreStatus}
                  compact
                />
              )}
              <div className="card p-7 sm:p-9 space-y-7">
                <div>
                  <h2 className="font-display text-2xl font-bold text-charcoal-900 flex items-center gap-2">
                    <Store size={24} className="text-spice-600" />
                    Store Operating Status & Automatic Next-Day Reopening
                  </h2>
                  <p className="mt-1 text-sm text-charcoal-600">
                    Control whether the stall is open, or choose "Close Shop for Today" to automatically reopen on the
                    next scheduled business day without needing manual reopening.
                  </p>
                </div>

              {/* Status Mode Banner */}
              {storeComputed.isForcedOpen ? (
                <div className="p-4 rounded-2xl bg-leaf-50 border border-leaf-200 text-leaf-900 flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-leaf-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Shop is Forced OPEN for Today ({istDate.dateString})</p>
                    <p className="text-xs text-leaf-800 mt-0.5">
                      Early / manual opening is active for today. Tomorrow at midnight IST, this override will
                      automatically expire and the regular daily schedule (7:30 PM – 12:00 AM IST) will resume.
                    </p>
                  </div>
                </div>
              ) : storeComputed.isClosedForToday ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                  <Calendar size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Shop is currently Closed for Today ({istDate.dateString})</p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      The shop will automatically reopen tomorrow according to the regular schedule (7:30 PM – 12:00 AM
                      IST). You can also click &quot;Resume Normal Schedule&quot; or &quot;OPEN NOW&quot; below at any
                      time.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 text-sky-900 flex items-start gap-3">
                  <Clock size={20} className="text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Automatic Schedule Active (7:30 PM – 12:00 AM IST Daily)</p>
                    <p className="text-xs text-sky-800 mt-0.5">
                      No manual override is active for today. The stall opens automatically at 7:30 PM and closes at 12:00 AM
                      midnight. All other hours are automatically marked closed. (Currently {storeComputed.isOpen ? 'OPEN' : 'CLOSED'}).
                    </p>
                  </div>
                </div>
              )}

              {/* Operating Status Direct Selector */}
              <div>
                <label className="block font-bold text-base text-charcoal-900 mb-2">
                  Operating Status (Today&apos;s Immediate Action)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={handleForceOpenNow}
                    disabled={statusSaving}
                    className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      storeComputed.isOpen
                        ? 'border-leaf-600 bg-leaf-50 ring-2 ring-leaf-500/30 text-leaf-900 shadow-md font-bold'
                        : 'border-spice-200 bg-white hover:border-leaf-300 text-charcoal-700 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className="h-3 w-3 rounded-full bg-leaf-500 animate-pulse" />
                      OPEN NOW
                    </span>
                    <span className="text-[11px] opacity-75">
                      {storeComputed.isForcedOpen
                        ? 'Author Early Opening Active'
                        : storeComputed.isOpen
                        ? 'Active & Taking Orders'
                        : 'Click to open stall early'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleForceCloseNow}
                    disabled={statusSaving}
                    className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      !storeComputed.isOpen
                        ? 'border-red-600 bg-red-50 ring-2 ring-red-500/30 text-red-900 shadow-md font-bold'
                        : 'border-spice-200 bg-white hover:border-red-300 text-charcoal-700 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      CLOSED NOW
                    </span>
                    <span className="text-[11px] opacity-75">
                      {storeComputed.isClosedForToday
                        ? 'Closed for Today (Active)'
                        : !storeComputed.isOpen
                        ? 'Currently Shut (Auto Schedule)'
                        : 'Click to close immediately'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* 1. Close Shop for Today */}
                <div className="p-5 rounded-2xl bg-red-50/70 border border-red-200 space-y-3">
                  <p className="font-bold text-base text-red-900">Close for Today Only</p>
                  <p className="text-xs text-red-700 leading-relaxed">
                    Immediately closes the stall for the current day and automatically reopens tomorrow at 7:30 PM IST.
                  </p>
                  <button
                    onClick={handleCloseShopForToday}
                    disabled={statusSaving || isClosedForToday}
                    className="btn bg-red-600 hover:bg-red-700 text-white text-xs py-2.5 px-4 w-full flex items-center justify-center gap-2 shadow-sm font-bold disabled:opacity-50"
                  >
                    <Calendar size={15} />
                    {isClosedForToday ? '✓ Closed For Today Active' : 'Close Shop for Today'}
                  </button>
                </div>

                {/* 2. Open / Regular Schedule Toggle */}
                <div className="p-5 rounded-2xl bg-leaf-50/70 border border-leaf-200 space-y-3">
                  <p className="font-bold text-base text-leaf-900">Resume Automatic Schedule</p>
                  <p className="text-xs text-leaf-700 leading-relaxed">
                    Clear any manual open/close overrides and strictly follow the real-time daily schedule (7:30 PM –
                    12:00 AM IST).
                  </p>
                  <button
                    onClick={handleResumeSchedule}
                    disabled={statusSaving}
                    className="btn bg-leaf-600 hover:bg-leaf-700 text-white text-xs py-2.5 px-4 w-full flex items-center justify-center gap-2 shadow-sm font-bold"
                  >
                    <CheckCircle2 size={15} />
                    Resume Normal Schedule / Clear Overrides
                  </button>
                </div>
              </div>

              {/* Crowd Level Selector */}
              <div>
                <label className="block font-bold text-base text-charcoal-900 mb-2 flex items-center gap-2">
                  <Users size={18} className="text-spice-600" />
                  Live Crowd Level
                </label>
                <p className="text-xs text-charcoal-600 mb-4">
                  Select the current crowd level. (Crowd information is automatically hidden from customers when the shop
                  is marked closed).
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['Low', 'Moderate', 'Busy', 'Very Busy'] as CrowdLevel[]).map((level) => {
                    const meta = CROWD_META[level];
                    const isSelected = crowd === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setCrowd(level)}
                        className={`p-4 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'border-spice-600 bg-spice-50 ring-2 ring-spice-500/20 shadow-md font-bold'
                            : 'border-spice-200 bg-white hover:border-spice-300 font-medium text-charcoal-700'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 rounded-full ${meta.dot} mb-2`} />
                        <p className={`text-sm ${isSelected ? 'text-spice-800' : 'text-charcoal-800'}`}>{level}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {statusMessage && (
                <div className="p-4 rounded-2xl bg-leaf-50 border border-leaf-200 text-leaf-800 text-sm font-semibold flex items-center gap-2 animate-fade-up">
                  <CheckCircle2 size={18} className="text-leaf-600" />
                  {statusMessage}
                </div>
              )}

              {statusError && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold flex items-center gap-2 animate-fade-up">
                  <AlertCircle size={18} className="text-red-600" />
                  {statusError}
                </div>
              )}

              <button
                onClick={handleSaveCrowdLevel}
                disabled={statusSaving}
                className="btn-primary w-full sm:w-auto py-3 px-8 flex items-center justify-center gap-2 shadow-warm"
              >
                {statusSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                {statusSaving ? 'Publishing Live Changes...' : 'Save Live Crowd Level'}
              </button>
              </div>
            </div>

            {/* Quick Live Preview */}
            <div className="lg:col-span-4 card p-6 bg-charcoal-900 text-white space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-marigold-400">
                Live Customer View Preview
              </h3>
              <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-spice-200">Shop Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      storeComputed.isOpen ? 'bg-leaf-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    {storeComputed.isOpen ? 'Open Now' : storeComputed.statusLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-spice-200">Next Opening Schedule</span>
                  <span className="text-xs font-bold text-marigold-300">{storeComputed.nextOpenText}</span>
                </div>

                {storeComputed.isOpen && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-spice-200">Crowd Meter</span>
                    <span className={`text-sm font-bold ${CROWD_META[crowd]?.color ?? 'text-white'}`}>{crowd}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-spice-200">Operating Hours</span>
                  <span className="text-xs font-semibold text-white">7:30 PM – 12:00 AM IST</span>
                </div>
              </div>
              <p className="text-xs text-spice-100/60 leading-relaxed">
                When closed, live ordering and rush metrics are hidden so customers see clean opening schedules.
              </p>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 2: MENU PRICES & STOCK MANAGER */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'products' && (
          <div className="mt-8 space-y-8 animate-fade-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-charcoal-900 flex items-center gap-2">
                  <Utensils size={24} className="text-spice-600" />
                  Real-Time Menu & Price Manager
                </h2>
                <p className="mt-1 text-sm text-charcoal-600">
                  Change item prices, toggle live availability (Available / Sold Out), edit descriptions, or add new items. Changes reflect instantly on the live website.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddMenuModal((prev) => !prev)}
                className="btn-primary py-2.5 px-5 text-sm font-bold flex items-center gap-2 shadow-warm shrink-0 cursor-pointer self-start sm:self-auto"
              >
                <Plus size={18} strokeWidth={2.5} />
                {showAddMenuModal ? 'Close Form' : 'Add New Menu Item'}
              </button>
            </div>

            {/* Hidden photo file input for new menu item */}
            <input
              ref={newMenuPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleNewMenuPhotoChange}
              className="hidden"
            />

            {/* ADD NEW MENU ITEM FORM CARD */}
            {showAddMenuModal && (
              <div className="card p-6 sm:p-8 bg-gradient-to-br from-spice-500/10 via-spice-50 to-white border-2 border-spice-300 shadow-md animate-scale-in">
                <div className="flex items-center justify-between pb-4 border-b border-spice-200">
                  <div>
                    <h3 className="font-display text-xl font-bold text-charcoal-900 flex items-center gap-2">
                      <Plus size={20} className="text-spice-600" strokeWidth={2.5} />
                      Add New Menu Item to Live Website
                    </h3>
                    <p className="text-xs text-charcoal-600 mt-0.5">
                      Enter details below. As soon as you save, this item will automatically display on the website menu and home availability.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddMenuModal(false)}
                    className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-800 hover:bg-spice-100 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddNewMenuItem} className="mt-6 space-y-6">
                  {addMenuError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{addMenuError}</span>
                    </div>
                  )}

                  {addMenuSuccess && (
                    <div className="p-3 rounded-xl bg-leaf-50 border border-leaf-200 text-xs font-semibold text-leaf-700 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>{addMenuSuccess}</span>
                    </div>
                  )}

                  <div className="grid gap-6 sm:grid-cols-2">
                    {/* Item Name */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                        Item Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newMenuItem.name}
                        onChange={(e) => setNewMenuItem((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Special Dahi Kachori, Sev Puri..."
                        className="w-full rounded-xl border border-spice-200 bg-white px-4 py-2.5 text-sm font-semibold text-charcoal-900 focus:border-spice-500"
                      />
                    </div>

                    {/* Dietary Type / Category */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                        Dietary Category / Preparation
                      </label>
                      <select
                        value={newMenuItem.dietaryType}
                        onChange={(e) =>
                          setNewMenuItem((prev) => ({
                            ...prev,
                            dietaryType: e.target.value as 'regular' | 'jain' | 'swaminarayan' | 'special',
                          }))
                        }
                        className="w-full rounded-xl border border-spice-200 bg-white px-4 py-2.5 text-sm font-semibold text-charcoal-900 focus:border-spice-500"
                      >
                        <option value="regular">Regular Classic Preparation</option>
                        <option value="jain">🌿 100% Jain Friendly (No Onion / No Garlic)</option>
                        <option value="swaminarayan">✨ Swaminarayan (Pure Satvik)</option>
                        <option value="special">⭐ Chef's Special Signature Item</option>
                      </select>
                    </div>

                    {/* Live Price in ₹ */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                        Live Price (₹) *
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-charcoal-400">₹</span>
                          <input
                            type="number"
                            min={1}
                            required
                            value={newMenuItem.price || ''}
                            onChange={(e) =>
                              setNewMenuItem((prev) => ({
                                ...prev,
                                price: e.target.value === '' ? 0 : Number(e.target.value),
                              }))
                            }
                            className="w-full rounded-xl border border-spice-200 bg-white pl-8 pr-4 py-2.5 text-base font-bold text-charcoal-900 focus:border-spice-500"
                          />
                        </div>
                        <div className="flex gap-1">
                          {[35, 40, 50, 60].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setNewMenuItem((prev) => ({ ...prev, price: preset }))}
                              className={`px-2.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                newMenuItem.price === preset
                                  ? 'bg-spice-600 text-white border-spice-600'
                                  : 'bg-white text-charcoal-700 border-spice-200 hover:bg-spice-50'
                              }`}
                            >
                              ₹{preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Availability Toggle */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                        Initial Availability
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setNewMenuItem((prev) => ({ ...prev, available: true }))}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            newMenuItem.available
                              ? 'bg-leaf-500 text-white border-leaf-600 shadow-sm'
                              : 'bg-white text-charcoal-700 border-spice-200 hover:bg-spice-50'
                          }`}
                        >
                          <CheckCircle2 size={14} /> In Stock (Available)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewMenuItem((prev) => ({ ...prev, available: false }))}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            !newMenuItem.available
                              ? 'bg-red-500 text-white border-red-600 shadow-sm'
                              : 'bg-white text-charcoal-700 border-spice-200 hover:bg-spice-50'
                          }`}
                        >
                          <XCircle size={14} /> Sold Out
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Photo Upload & Preview */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                      Item Photo (Optional)
                    </label>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-spice-200 bg-charcoal-900 grid place-items-center shrink-0">
                        {newMenuItem.image_url ? (
                          <img
                            src={newMenuItem.image_url}
                            alt="New menu item"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-2 text-spice-300">
                            <Utensils size={20} className="mx-auto" />
                            <span className="text-[9px] font-bold block mt-1">Default Icon</span>
                          </div>
                        )}
                        {newMenuPhotoUploading && (
                          <div className="absolute inset-0 bg-charcoal-950/70 grid place-items-center text-white">
                            <RefreshCw size={18} className="animate-spin text-marigold-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => newMenuPhotoInputRef.current?.click()}
                          disabled={newMenuPhotoUploading}
                          className="btn-outline py-2 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera size={14} />
                          {newMenuItem.image_url ? 'Change Photo' : 'Upload Photo'}
                        </button>
                        {newMenuItem.image_url && (
                          <button
                            type="button"
                            onClick={() => setNewMenuItem((prev) => ({ ...prev, image_url: '' }))}
                            className="btn py-2 px-3 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer rounded-xl"
                          >
                            Remove
                          </button>
                        )}
                        <span className="text-[11px] text-charcoal-500">
                          Allowed: JPEG, PNG, WebP • Auto-optimized for ultra-fast loading
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={newMenuItem.description}
                      onChange={(e) => setNewMenuItem((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="e.g. Crisp golden-fried Kachori topped with house chutneys and fresh spices..."
                      className="w-full rounded-xl border border-spice-200 bg-white p-3 text-xs text-charcoal-900 focus:border-spice-500 resize-none"
                    />
                  </div>

                  {/* Featured / Signature Toggle */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new-item-featured"
                      checked={newMenuItem.featured}
                      onChange={(e) => setNewMenuItem((prev) => ({ ...prev, featured: e.target.checked }))}
                      className="rounded border-spice-300 text-spice-600 focus:ring-spice-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="new-item-featured" className="text-xs font-bold text-charcoal-800 cursor-pointer">
                      ⭐ Mark as Signature / Featured Item
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-spice-200">
                    <button
                      type="button"
                      onClick={() => setShowAddMenuModal(false)}
                      className="btn-outline py-2.5 px-4 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isAddingMenu}
                      className="btn-primary py-2.5 px-6 text-sm font-bold flex items-center gap-2 shadow-warm cursor-pointer disabled:opacity-50"
                    >
                      {isAddingMenu ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
                      {isAddingMenu ? 'Adding to Menu...' : 'Publish Menu Item Live'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {productsError && (
              <SectionError
                title="Unable to load menu items."
                message={productsError}
                onRetry={refetchProducts}
                compact
              />
            )}

            {/* Hidden file input for uploading/replacing product photo */}
            <input
              ref={productPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleProductPhotoFileChange}
              className="hidden"
            />

            <div className="grid gap-8 lg:grid-cols-2">
              {(products ?? []).map((product) => {
                const form = productForms[product.slug] ?? productForms[product.id] ?? {
                  price: product.price,
                  available: product.available,
                  stock: product.stock ?? 0,
                  description: product.description,
                };
                const saving = productSaving[product.slug] || productSaving[product.id];
                const isPhotoUploading = productImageUploading[product.slug] || productImageUploading[product.id];
                const msg = productMessages[product.slug] || productMessages[product.id];

                return (
                  <div key={product.id || product.slug} className="card p-7 sm:p-8 space-y-6 flex flex-col justify-between">
                    <div className="space-y-5">
                      {/* Product Header & Photo Management */}
                      <div className="flex items-start gap-4">
                        <div className="relative group shrink-0">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-24 w-24 rounded-2xl object-cover border border-spice-100 shadow-md shrink-0 bg-charcoal-900"
                            />
                          ) : (
                            <div className="h-24 w-24 rounded-2xl bg-spice-100/80 border border-spice-200 grid place-items-center text-spice-600 shrink-0 text-center p-2">
                              <Utensils size={24} />
                              <span className="text-[10px] font-bold text-spice-800 leading-tight">No Photo</span>
                            </div>
                          )}

                          {isPhotoUploading && (
                            <div className="absolute inset-0 bg-charcoal-900/70 rounded-2xl grid place-items-center text-white backdrop-blur-[1px]">
                              <RefreshCw size={22} className="animate-spin text-marigold-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-2xl font-bold text-charcoal-900 truncate">{product.name}</h3>
                            <span className="text-xs font-bold uppercase tracking-wider text-spice-600 bg-spice-100 px-2.5 py-1 rounded-full shrink-0">
                              {product.slug}
                            </span>
                          </div>
                          <p className="text-xs text-charcoal-500 mt-1">
                            {product.slug.includes('jain')
                              ? '🌿 Jain Friendly (No Onion / No Garlic)'
                              : product.slug.includes('swaminarayan')
                              ? '✨ Swaminarayan (Satvik Preparation)'
                              : 'Signature Food Item'}
                          </p>

                          {/* Image Upload / Replace Action Buttons */}
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleTriggerProductPhotoUpload(product)}
                              disabled={isPhotoUploading}
                              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-spice-600 hover:bg-spice-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                              title="Select an image to upload or replace for this product"
                            >
                              <Camera size={14} />
                              {product.image_url ? 'Replace Photo' : 'Upload Photo'}
                            </button>

                            {product.image_url && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProductPhoto(product)}
                                disabled={isPhotoUploading}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                title="Remove photo and display default icon"
                              >
                                <Trash2 size={13} />
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live Price Management with Instant Save */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-charcoal-700 flex items-center gap-1">
                            <IndianRupee size={13} className="text-spice-600" /> Live Price (₹)
                          </label>
                          <span className="text-[11px] text-charcoal-500 font-medium">Auto-saves on change or blur</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-charcoal-400">
                              ₹
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={form.price}
                              onFocus={() => setActiveEditingSlug(product.slug)}
                              onChange={(e) => {
                                const newPrice = Number(e.target.value);
                                setProductForms((prev) => ({
                                  ...prev,
                                  [product.slug]: { ...form, price: newPrice },
                                  [product.id]: { ...form, price: newPrice },
                                }));
                              }}
                              onBlur={() => {
                                setActiveEditingSlug(null);
                                handleQuickPriceSave(product);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setActiveEditingSlug(null);
                                  handleQuickPriceSave(product);
                                }
                              }}
                              className="w-full rounded-xl border border-spice-200 bg-spice-50/50 pl-8 pr-4 py-2.5 text-base font-bold text-charcoal-900 focus:border-spice-500 focus:bg-white"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleQuickPriceSave(product)}
                            className="px-4 py-2.5 rounded-xl bg-spice-600 hover:bg-spice-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
                            title="Instantly save and apply this price across the entire website"
                          >
                            <Check size={15} strokeWidth={2.5} />
                            Save Price
                          </button>
                        </div>

                        {/* Quick Price Increment / Decrement & Presets */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-charcoal-500 mr-1">Quick:</span>
                          {[-5, 5].map((delta) => {
                            const newPrice = Math.max(1, form.price + delta);
                            return (
                              <button
                                key={delta}
                                type="button"
                                onClick={() => handleQuickPriceSave(product, newPrice)}
                                className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-spice-100 hover:bg-spice-200 text-spice-800 border border-spice-200 transition-colors cursor-pointer active:scale-95"
                              >
                                {delta > 0 ? `+₹${delta}` : `-₹${Math.abs(delta)}`}
                              </button>
                            );
                          })}
                          {[35, 40, 45, 50].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleQuickPriceSave(product, preset)}
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors cursor-pointer active:scale-95 ${
                                form.price === preset
                                  ? 'bg-spice-600 text-white shadow-xs'
                                  : 'bg-spice-50 hover:bg-spice-100 text-charcoal-700 border border-spice-200'
                              }`}
                            >
                              ₹{preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Availability Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-spice-50/70 border border-spice-100">
                        <div>
                          <p className="text-xs font-bold text-charcoal-800 uppercase flex items-center gap-1.5">
                            Availability Status
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${
                                form.available ? 'bg-leaf-500 animate-pulse' : 'bg-red-500'
                              }`}
                            />
                          </p>
                          <p className="text-xs text-charcoal-500 mt-0.5">
                            {form.available
                              ? 'Currently marked as AVAILABLE on website'
                              : 'Currently marked as SOLD OUT on website'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(product, !form.available)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer select-none ${
                            form.available
                              ? 'bg-leaf-500 text-white hover:bg-leaf-600 shadow-leaf-500/20'
                              : 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                          }`}
                          title="Click to instantly toggle live status between In Stock and Sold Out"
                        >
                          {form.available ? (
                            <CheckCircle2 size={15} className="shrink-0" />
                          ) : (
                            <XCircle size={15} className="shrink-0" />
                          )}
                          <span>
                            {form.available ? '✓ In Stock (Live)' : '✕ Sold Out (Live)'}
                          </span>
                        </button>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={form.description}
                          onChange={(e) => {
                            const newDesc = e.target.value;
                            setProductForms((prev) => ({
                              ...prev,
                              [product.slug]: { ...form, description: newDesc },
                              [product.id]: { ...form, description: newDesc },
                            }));
                          }}
                          className="w-full rounded-xl border border-spice-200 bg-spice-50/50 p-3 text-xs text-charcoal-900 focus:border-spice-500 focus:bg-white resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-spice-100 flex flex-col gap-3">
                      {msg && (
                        <p className="text-xs font-bold text-leaf-700 flex items-center gap-1.5 animate-fade-up">
                          <CheckCircle2 size={15} /> {msg}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveProduct(product)}
                          disabled={saving}
                          className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2 shadow-warm cursor-pointer"
                        >
                          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                          {saving ? 'Updating Live Price & Details...' : `Save ${product.name} Details`}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                          className="p-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer shrink-0"
                          title={`Delete ${product.name} from menu`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 3: GALLERY & FOLDER MANAGEMENT */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'gallery' && (
          <div className="mt-8 space-y-8 animate-fade-up">
            <div>
              <h2 className="font-display text-2xl font-bold text-charcoal-900 flex items-center gap-2">
                <ImageIcon size={24} className="text-spice-600" />
                Gallery & Media Folder Manager
              </h2>
              <p className="mt-1 text-sm text-charcoal-600">
                Upload photos and videos directly into the 4 designated folders: <strong>Customers</strong>,{' '}
                <strong>Stall</strong>, <strong>Food / Menu</strong>, or <strong>Videos (MP4/MP3)</strong>.
              </p>
            </div>

            {/* Upload Box with Visual Folder Chooser */}
            <div className="card p-7 sm:p-8 bg-gradient-to-br from-spice-500/10 via-spice-50 to-white border border-spice-300">
              <h3 className="font-display text-xl font-bold text-charcoal-900 flex items-center gap-2">
                <Upload size={20} className="text-spice-600" />
                Upload New Photo or Video into a Website Folder
              </h3>

              <form onSubmit={handleUploadImage} className="mt-5 space-y-6">
                {uploadError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="p-3 rounded-xl bg-leaf-50 border border-leaf-200 text-xs font-medium text-leaf-700 flex items-center gap-2">
                    <CheckCircle2 size={15} className="shrink-0" />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {/* 1. Step: Select Target Folder / Section */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-800 mb-2 flex items-center gap-1.5">
                    <Folder size={14} className="text-spice-600" />
                    1. Select Destination Folder (4 Folders):
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    {folderCategories.map((folder) => {
                      const isSelected = uploadCategory === folder.id;
                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => setUploadCategory(folder.id)}
                          className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 sm:gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-spice-600 bg-white ring-2 ring-spice-500 shadow-md'
                              : 'border-spice-200 bg-white/70 hover:bg-white hover:border-spice-300'
                          }`}
                        >
                          <span
                            className={`p-2 rounded-xl shrink-0 ${
                              isSelected ? 'bg-spice-600 text-white' : 'bg-spice-100 text-spice-700'
                            }`}
                          >
                            {folder.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-bold truncate ${isSelected ? 'text-spice-800' : 'text-charcoal-900'}`}>
                                {folder.label}
                              </p>
                              {isSelected && <Check size={14} className="text-spice-600 shrink-0 ml-1" />}
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-charcoal-500 mt-0.5 line-clamp-1 sm:line-clamp-2">{folder.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Step: Choose File & Enter Caption */}
                <div className="grid gap-5 md:grid-cols-12 pt-2 border-t border-spice-200">
                  {/* File Picker & Preview */}
                  <div className="md:col-span-5 flex flex-col justify-center">
                    <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                      2. Choose Media File (Image, Video or Audio)
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/*,audio/mp3,audio/mpeg,audio/wav,audio/*"
                      className="block w-full text-xs text-charcoal-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-spice-600 file:text-white hover:file:bg-spice-700 cursor-pointer"
                    />
                    <p className="text-[11px] text-charcoal-500 mt-1.5">
                      Supported: Photos (JPEG, PNG, WebP) • Videos (MP4, WebM up to 25MB) • Audio (MP3 up to 25MB)
                    </p>

                    {previewDataUrl && (
                      <div className="mt-3 relative rounded-xl overflow-hidden border border-spice-200 aspect-[4/3] bg-charcoal-950 max-w-[240px]">
                        {previewMediaType === 'video' ? (
                          <video
                            src={previewDataUrl}
                            controls
                            className="h-full w-full object-cover"
                          />
                        ) : previewMediaType === 'audio' ? (
                          <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-charcoal-900 text-white">
                            <Music size={32} className="text-marigold-400 mb-2" />
                            <span className="text-xs font-bold">Audio Preview</span>
                            <audio src={previewDataUrl} controls className="w-full mt-2" />
                          </div>
                        ) : (
                          <img src={previewDataUrl} alt="Preview" className="h-full w-full object-cover" />
                        )}
                        <span className="absolute bottom-1 left-1 right-1 bg-charcoal-950/80 text-white text-[10px] py-0.5 text-center rounded">
                          Upload Preview ({previewMediaType.toUpperCase()})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Caption & Alt */}
                  <div className="md:col-span-7 space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                        3. Caption / Title (Optional)
                      </label>
                      <input
                        type="text"
                        value={uploadCaption}
                        onChange={(e) => setUploadCaption(e.target.value)}
                        placeholder="e.g. Regular customers enjoying fresh Kachori, evening stall clip..."
                        className="w-full rounded-xl border border-spice-200 bg-white px-3.5 py-2.5 text-sm text-charcoal-900 focus:border-spice-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-charcoal-700 mb-1.5">
                        4. Accessibility Description (Alt text)
                      </label>
                      <input
                        type="text"
                        value={uploadAlt}
                        onChange={(e) => setUploadAlt(e.target.value)}
                        placeholder="e.g. Customers smiling with plates at the stall"
                        className="w-full rounded-xl border border-spice-200 bg-white px-3.5 py-2.5 text-sm text-charcoal-900 focus:border-spice-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUploading || !previewDataUrl}
                    className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2 shadow-warm disabled:opacity-50 cursor-pointer"
                  >
                    {isUploading ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                    {isUploading
                      ? 'Uploading Media...'
                      : `Save & Publish to ${folderCategories.find((f) => f.id === uploadCategory)?.label}`}
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Gallery Photos & Media List with Folder Filtering */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-xl font-bold text-charcoal-900">
                    Uploaded Media ({filteredGallery.length})
                  </h3>

                  {/* Folder filter */}
                  <select
                    value={galleryFilterFolder}
                    onChange={(e) => setGalleryFilterFolder(e.target.value as GalleryCategory)}
                    className="rounded-xl border border-spice-200 bg-white px-3 py-1.5 text-xs font-bold text-charcoal-800 cursor-pointer"
                  >
                    <option value="all">📁 All Folders ({galleryImages?.length ?? 0})</option>
                    <option value="customers">
                      👥 Customers ({galleryImages?.filter((g) => g.category === 'customers').length ?? 0})
                    </option>
                    <option value="stall">
                      🛒 Stall / Cart ({galleryImages?.filter((g) => g.category === 'stall' || (g.category as string) === 'shop').length ?? 0})
                    </option>
                    <option value="food">
                      🍽️ Food / Menu ({galleryImages?.filter((g) => g.category === 'food').length ?? 0})
                    </option>
                    <option value="videos">
                      🎬 Videos & Clips ({galleryImages?.filter((g) => g.category === 'videos' || g.media_type === 'video' || g.media_type === 'audio').length ?? 0})
                    </option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={handleSyncGalleryToCloud}
                    disabled={syncingGallery}
                    className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Publish all author media so every customer phone and device shows the exact same gallery"
                  >
                    <RefreshCw size={13} className={syncingGallery ? 'animate-spin' : ''} />
                    {syncingGallery ? 'Syncing...' : 'Sync All Devices'}
                  </button>
                  <button
                    onClick={refetchGallery}
                    className="btn-outline text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={loadingGallery ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                  {(galleryImages?.length ?? 0) > 0 && (
                    <button
                      onClick={handleClearAllGallery}
                      disabled={syncingGallery}
                      className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Delete all media from gallery to start fresh"
                    >
                      <Trash2 size={13} />
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {gallerySyncMsg && (
                <div className="p-3 bg-leaf-50 border border-leaf-200 text-leaf-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 size={15} className="text-leaf-600 shrink-0" />
                  <span>{gallerySyncMsg}</span>
                </div>
              )}

              {loadingGallery ? (
                <SectionSkeleton variant="gallery" count={6} />
              ) : galleryError ? (
                <SectionError
                  title="Unable to load gallery media."
                  message={galleryError}
                  onRetry={refetchGallery}
                />
              ) : filteredGallery.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredGallery.map((img) => {
                    const isVideo =
                      img.media_type === 'video' ||
                      img.src.toLowerCase().endsWith('.mp4') ||
                      img.src.toLowerCase().endsWith('.webm') ||
                      img.src.startsWith('data:video/');
                    const isAudio =
                      img.media_type === 'audio' ||
                      img.src.toLowerCase().endsWith('.mp3') ||
                      img.src.toLowerCase().endsWith('.wav') ||
                      img.src.startsWith('data:audio/');

                    return (
                      <div key={img.id} className="card p-4 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-charcoal-950">
                            {isVideo ? (
                              <video
                                src={img.src}
                                preload="metadata"
                                muted
                                playsInline
                                className="h-full w-full object-cover"
                              />
                            ) : isAudio ? (
                              <div className="h-full w-full flex flex-col items-center justify-center bg-charcoal-900 text-white p-4">
                                <Music size={32} className="text-marigold-400 mb-2" />
                                <span className="text-xs font-bold">Audio Clip (MP3)</span>
                              </div>
                            ) : (
                              <img
                                src={img.src}
                                alt={img.alt}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            )}
                            <span className="absolute top-2 left-2 rounded-full bg-charcoal-900/85 backdrop-blur-md text-marigold-300 text-[10px] font-bold uppercase px-2.5 py-0.5 border border-white/20">
                              {isVideo
                                ? '🎬 Video'
                                : isAudio
                                ? '🎵 Audio'
                                : img.category === 'customers'
                                ? '👥 Customers'
                                : img.category === 'stall' || (img.category as string) === 'shop'
                                ? '🛒 Stall'
                                : '🍽️ Food'}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-charcoal-900 mt-3 truncate">{img.caption || img.alt}</p>
                          <p className="text-[11px] text-charcoal-400 mt-0.5">
                            Uploaded: {img.created_at ? new Date(img.created_at).toLocaleDateString() : 'Active'}
                          </p>
                        </div>

                        {/* Move Category / Action Buttons */}
                        <div className="pt-2 border-t border-spice-100 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="text-[11px] text-charcoal-500 font-semibold">Folder:</span>
                            <select
                              value={
                                (img.category as string) === 'shop' ||
                                (img.category as string) === 'home' ||
                                (img.category as string) === 'about'
                                  ? 'stall'
                                  : img.category
                              }
                              onChange={(e) =>
                                handleChangeImageCategory(img.id, e.target.value as GalleryImage['category'])
                              }
                              className="text-xs bg-spice-50 border border-spice-200 rounded-lg px-2 py-1 text-charcoal-800 font-semibold cursor-pointer"
                            >
                              <option value="customers">👥 Customers</option>
                              <option value="stall">🛒 Stall / Cart</option>
                              <option value="food">🍽️ Food / Menu</option>
                              <option value="videos">🎬 Videos (MP4/MP3)</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-spice-50">
                            <button
                              onClick={() => handleTriggerReplace(img.id)}
                              className="btn-outline text-[11px] py-1.5 px-2.5 text-charcoal-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Upload size={12} /> Replace Media
                            </button>
                            <button
                              onClick={() => handleDeleteGalleryImage(img.id)}
                              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold p-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-12 text-center max-w-md mx-auto">
                  <ImageIcon size={36} className="mx-auto text-spice-300" />
                  <h3 className="mt-4 font-display text-lg font-bold text-charcoal-900">No Media in this Folder</h3>
                  <p className="mt-1 text-sm text-charcoal-600">
                    Upload a photo or video and assign it to this section above.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* TAB 4: CUSTOMER REVIEWS & FEEDBACK */}
        {/* ---------------------------------------------------- */}
        {activeTab === 'feedback' && (
          <div className="mt-8 space-y-8 animate-fade-up">
            {/* Google Sheets Integration Box */}
            <div className="card p-6 sm:p-7 bg-gradient-to-br from-leaf-500/10 via-spice-50 to-white border border-leaf-500/30 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-600 text-white shadow-md shrink-0">
                    <FileSpreadsheet size={20} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-charcoal-900 flex items-center gap-2">
                      Live Google Sheets Auto-Sync
                    </h3>
                    <p className="text-xs text-charcoal-600">
                      Forward every new customer rating and review directly into your Google Sheet in real time.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-leaf-800 bg-leaf-100/80 border border-leaf-300 rounded-lg px-3 py-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-leaf-600 animate-pulse" />
                  Real-time Auto-Sync Active
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="Paste Google Apps Script URL here"
                  className="flex-1 rounded-xl border border-spice-200 bg-white px-4 py-2.5 text-xs text-charcoal-900 placeholder:text-charcoal-400 focus:border-leaf-500 focus:ring-1 focus:ring-leaf-500"
                />
                <button
                  onClick={handleSaveSheetUrl}
                  disabled={syncingReviews}
                  className="btn bg-leaf-600 hover:bg-leaf-700 text-white text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  {syncingReviews ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {syncingReviews ? 'Syncing Reviews...' : 'Save Link & Sync Reviews'}
                </button>
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-sm shrink-0 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={testingWebhook ? 'animate-spin' : ''} />
                  {testingWebhook ? 'Testing...' : 'Test Webhook'}
                </button>
              </div>

              {sheetUrlSaved && (
                <p className="text-xs font-bold text-leaf-700 flex items-center gap-1.5 animate-fade-up">
                  <CheckCircle2 size={14} /> Google Sheet webhook saved!
                </p>
              )}

              {webhookTestResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-fade-up ${
                    webhookTestResult.success
                      ? 'bg-leaf-50 border border-leaf-200 text-leaf-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  {webhookTestResult.success ? (
                    <CheckCircle2 size={15} className="text-leaf-600 shrink-0" />
                  ) : (
                    <AlertCircle size={15} className="text-red-600 shrink-0" />
                  )}
                  <span>{webhookTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Header with Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-charcoal-900 flex items-center gap-2">
                  <MessageSquare size={24} className="text-spice-600" />
                  Customer Reviews & Feedback Submissions
                </h2>
                <p className="mt-1 text-sm text-charcoal-600">
                  Real feedback stored in your database. Click "Feature on Homepage" to display selected reviews on the
                  main site.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onNavigate('home')}
                  className="btn-outline text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  View Website Reviews ↗
                </button>
                <button
                  onClick={refetchFeedback}
                  className="btn-outline text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={loadingFeedback ? 'animate-spin' : ''} />
                  Refresh Reviews
                </button>
              </div>
            </div>

            {feedbackActionMsg && (
              <div className="p-3 rounded-xl bg-leaf-50 border border-leaf-200 text-xs font-bold text-leaf-800 flex items-center gap-2 animate-fade-up">
                <CheckCircle2 size={15} className="text-leaf-600" />
                <span>{feedbackActionMsg}</span>
              </div>
            )}

            {feedbackActionError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex items-center gap-2 animate-fade-up">
                <AlertCircle size={15} className="text-red-600" />
                <span>{feedbackActionError}</span>
              </div>
            )}

            {loadingFeedback ? (
              <SectionSkeleton variant="grid" count={4} />
            ) : feedbackError ? (
              <SectionError
                title="Unable to load customer feedback."
                message={feedbackError}
                onRetry={refetchFeedback}
              />
            ) : feedbackList && feedbackList.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {feedbackList.map((f) => (
                  <div
                    key={f.id}
                    className={`card p-5 sm:p-6 flex flex-col justify-between space-y-4 border transition-all ${
                      f.approved ? 'border-leaf-400 bg-leaf-50/20 shadow-sm' : 'border-spice-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-base text-charcoal-900">
                              {f.customer_name || 'Anonymous Customer'}
                            </p>
                            {f.approved && (
                              <span className="inline-flex items-center gap-1 bg-leaf-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <Star size={10} className="fill-white" /> Featured on Homepage
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-charcoal-400 mt-0.5">
                            {f.created_at ? formatTime(new Date(f.created_at)) : 'Recent'}
                          </p>
                        </div>
                        <StarRating value={f.overall_rating} size={16} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {f.food_rating ? (
                          <span className="bg-spice-100 text-spice-800 px-2 py-0.5 rounded-md font-medium">
                            Food: {f.food_rating}★
                          </span>
                        ) : null}
                        {f.service_rating ? (
                          <span className="bg-spice-100 text-spice-800 px-2 py-0.5 rounded-md font-medium">
                            Service: {f.service_rating}★
                          </span>
                        ) : null}
                        {f.cleanliness_rating ? (
                          <span className="bg-spice-100 text-spice-800 px-2 py-0.5 rounded-md font-medium">
                            Cleanliness: {f.cleanliness_rating}★
                          </span>
                        ) : null}
                      </div>

                      {f.message && (
                        <p className="mt-3 text-sm text-charcoal-700 italic bg-spice-50/60 p-3 rounded-xl border border-spice-100 break-words [overflow-wrap:anywhere] whitespace-pre-line leading-relaxed">
                          "{f.message}"
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-spice-100 flex items-center justify-between gap-3">
                      <button
                        onClick={() => handleToggleApprove(f.id, f.approved)}
                        disabled={feedbackActionId === f.id}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors flex items-center gap-1.5 ${
                          f.approved
                            ? 'bg-leaf-100 border-leaf-300 text-leaf-800 hover:bg-leaf-200'
                            : 'bg-spice-100 border-spice-300 text-spice-800 hover:bg-spice-200'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <Check size={14} />
                        {f.approved ? 'Featured (Click to Unfeature)' : 'Feature on Homepage'}
                      </button>

                      <button
                        onClick={() => handleDeleteFeedback(f.id)}
                        disabled={feedbackActionId === f.id}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold p-1 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-12 text-center max-w-md mx-auto">
                <MessageSquare size={36} className="mx-auto text-spice-300" />
                <h3 className="mt-4 font-display text-lg font-bold text-charcoal-900">No Feedback Yet</h3>
                <p className="mt-1 text-sm text-charcoal-600">
                  New customer submissions from the website will appear here in real time.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
