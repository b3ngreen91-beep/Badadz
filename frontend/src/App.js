import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerInstall from './pages/OwnerInstall';
import AdvertiserDashboard from './pages/AdvertiserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CheckoutResult from './pages/CheckoutResult';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import RefundPolicy from './pages/RefundPolicy';
import HowItWorks from './pages/HowItWorks';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="App flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/listings/new" element={
                <ProtectedRoute role="owner"><CreateListing /></ProtectedRoute>
              } />
              <Route path="/listings/:id/edit" element={
                <ProtectedRoute role="owner"><EditListing /></ProtectedRoute>
              } />
              <Route path="/listings/:id" element={<ListingDetail />} />
              <Route path="/dashboard/owner" element={
                <ProtectedRoute role="owner"><OwnerDashboard /></ProtectedRoute>
              } />
              <Route path="/dashboard/owner/install" element={
                <ProtectedRoute role="owner"><OwnerInstall /></ProtectedRoute>
              } />
              <Route path="/dashboard/advertiser" element={
                <ProtectedRoute role="advertiser"><AdvertiserDashboard /></ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute><AdminDashboard /></ProtectedRoute>
              } />
              <Route path="/checkout/success" element={<CheckoutResult kind="success" />} />
              <Route path="/checkout/cancel" element={<CheckoutResult kind="cancel" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
          <Toaster theme="dark" position="top-right" toastOptions={{ style: { borderRadius: 0, border: '1px solid #2A2A2A', background: '#0a0a0a' } }} />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
