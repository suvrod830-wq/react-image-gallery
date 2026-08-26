import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { Spinner } from './components/ui/Feedback';

// Route-level code splitting (spec §52).
const Home = lazy(() => import('./pages/Home'));
const Gallery = lazy(() => import('./pages/Gallery'));
const ImageDetails = lazy(() => import('./pages/ImageDetails'));
const Categories = lazy(() => import('./pages/Categories'));
const CategoryDetails = lazy(() => import('./pages/CategoryDetails'));
const Tags = lazy(() => import('./pages/Tags'));
const TagDetails = lazy(() => import('./pages/TagDetails'));
const Authors = lazy(() => import('./pages/Authors'));
const AuthorDetails = lazy(() => import('./pages/AuthorDetails'));
const Albums = lazy(() => import('./pages/Albums'));
const AlbumDetails = lazy(() => import('./pages/AlbumDetails'));
const NotFound = lazy(() => import('./pages/NotFound'));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminImages = lazy(() => import('./pages/admin/AdminImages'));
const UploadImage = lazy(() => import('./pages/admin/UploadImage'));
const EditImage = lazy(() => import('./pages/admin/EditImage'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminTags = lazy(() => import('./pages/admin/AdminTags'));
const AdminAuthors = lazy(() => import('./pages/admin/AdminAuthors'));
const AdminAlbums = lazy(() => import('./pages/admin/AdminAlbums'));
const Settings = lazy(() => import('./pages/admin/Settings'));

function PageFallback() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public site */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/image/:slug" element={<ImageDetails />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/category/:slug" element={<CategoryDetails />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/tag/:slug" element={<TagDetails />} />
            <Route path="/authors" element={<Authors />} />
            <Route path="/author/:slug" element={<AuthorDetails />} />
            <Route path="/albums" element={<Albums />} />
            <Route path="/album/:slug" element={<AlbumDetails />} />
          </Route>

          {/* Admin auth (public) */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Admin area — protected */}
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/images" element={<AdminImages />} />
            <Route path="/admin/images/upload" element={<UploadImage />} />
            <Route path="/admin/images/:id/edit" element={<EditImage />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/tags" element={<AdminTags />} />
            <Route path="/admin/authors" element={<AdminAuthors />} />
            <Route path="/admin/albums" element={<AdminAlbums />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
