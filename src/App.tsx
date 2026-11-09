import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import Navbar, { type Page } from '@/components/Navbar';
import Footer from '@/components/Footer';
import Home from '@/pages/Home';
import { BRAND } from '@/lib/constants';
import { LoadingProvider, useLoading } from '@/lib/loadingContext';
import SmartLoadingScreen from '@/components/SmartLoadingScreen';

const Menu = lazy(() => import('@/pages/Menu'));
const Gallery = lazy(() => import('@/pages/Gallery'));
const Feedback = lazy(() => import('@/pages/Feedback'));
const Directions = lazy(() => import('@/pages/Directions'));
const Admin = lazy(() => import('@/pages/Admin'));

const PAGE_META: Record<Page, { title: string; description: string }> = {
  home: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: 'Famous local Indian street-food shop serving fresh Kachori and Bhel. Check live availability, store status, menu, gallery, and find us on the map.',
  },
  menu: {
    title: `Menu — ${BRAND.name}`,
    description: 'View our menu — crispy Kachori and fresh Bhel with live prices and availability. Made fresh daily at Paras Kachoriwala.',
  },
  gallery: {
    title: `Gallery — ${BRAND.name}`,
    description: 'Real photos of our food, shop, and happy customers at Paras Kachoriwala.',
  },
  feedback: {
    title: `Feedback — ${BRAND.name}`,
    description: 'Share your experience at Paras Kachoriwala. Rate our food, service, and cleanliness.',
  },
  directions: {
    title: `Get Directions & Location — ${BRAND.name}`,
    description: 'Get directions to Paras Kachoriwala on Google Maps. Operating daily from 7:30 PM to 12:00 AM with live status.',
  },
  admin: {
    title: `Author Management Portal — ${BRAND.name}`,
    description: 'Real-time store status, price management, and stock control for Paras Kachoriwala.',
  },
};

function AppInner() {
  const [page, setPage] = useState<Page>('home');
  const { isLoading } = useLoading();

  const navigate = (p: Page) => {
    if (p === page) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      return;
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  useEffect(() => {
    const meta = PAGE_META[page];
    document.title = meta.title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', meta.description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.description);
  }, [page]);

  const pageContent = useMemo(() => {
    switch (page) {
      case 'home':
        return <Home onNavigate={navigate} />;
      case 'menu':
        return <Menu />;
      case 'gallery':
        return <Gallery />;
      case 'feedback':
        return <Feedback />;
      case 'directions':
        return <Directions />;
      case 'admin':
        return <Admin onNavigate={navigate} />;
      default:
        return <Home onNavigate={navigate} />;
    }
  }, [page, navigate]);

  return (
    <>
      <SmartLoadingScreen visible={isLoading} />
      <div className="min-h-screen flex flex-col">
        <Navbar current={page} onNavigate={navigate} />
        <main className="flex-1">
          <Suspense
            fallback={
              <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-spice-500 border-t-transparent" />
              </div>
            }
          >
            {pageContent}
          </Suspense>
        </main>
        <Footer onNavigate={navigate} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <LoadingProvider>
      <AppInner />
    </LoadingProvider>
  );
}
