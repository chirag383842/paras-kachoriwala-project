export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  available: boolean;
  stock: number | null;
  featured: boolean;
  display_order: number;
  updated_at?: string;
};

export type StoreStatus = {
  id: string;
  is_open: boolean;
  crowd_level: string;
  last_updated: string;
  updated_by?: string;
  closed_for_date?: string | null;
  force_open_date?: string | null;
  override_mode?: 'force_open' | 'force_close' | 'closed_now' | 'closed_today' | 'auto' | null;
};

export type Feedback = {
  id: string;
  overall_rating: number;
  food_rating: number | null;
  service_rating: number | null;
  cleanliness_rating: number | null;
  message: string | null;
  customer_name: string | null;
  approved: boolean;
  created_at: string;
};

export type Review = {
  id: string;
  rating: number;
  message: string;
  customer_name: string;
  display_order?: number;
  created_at?: string;
  source?: 'justdial' | 'verified';
};

export type GalleryCategory = 'all' | 'customers' | 'stall' | 'food' | 'videos';

export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
  category: 'customers' | 'stall' | 'food' | 'videos' | 'shop' | 'about' | 'home';
  media_type?: 'image' | 'video' | 'audio';
  caption?: string;
  display_order?: number;
  created_at?: string;
};
