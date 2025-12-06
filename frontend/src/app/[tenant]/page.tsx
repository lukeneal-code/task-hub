'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Tenant home page.
 * Shows login prompt or redirects to projects.
 */
export default function TenantHomePage() {
  const { isAuthenticated, isLoading, error, login, tenant } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Initializing authentication..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="card">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Error
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <a href="/" className="btn btn-primary">
              Return Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            {tenant && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  {tenant.name}
                </h1>
                <p className="text-gray-500">Welcome to TaskHub</p>
              </div>
            )}

            <p className="text-gray-600 mb-6">
              Sign in with your organization credentials to access your projects
              and tasks.
            </p>

            <button onClick={login} className="w-full btn btn-primary py-3">
              Sign In
            </button>

            <div className="mt-6 text-sm text-gray-500">
              <p>
                Powered by Keycloak SSO with role-based access control
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard when authenticated
  return (
    <Layout>
      <div className="text-center py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to {tenant?.name}
        </h1>
        <p className="text-gray-600 mb-8">
          You are signed in. Choose an option below to get started.
        </p>
        <Link
          href={`/${tenant?.slug}/projects`}
          className="btn btn-primary text-lg px-8 py-3"
        >
          View Projects
        </Link>
      </div>
    </Layout>
  );
}
