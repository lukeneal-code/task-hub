'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Icon for external IDP buttons
 */
function ExternalIdpIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}

/**
 * Tenant home page.
 * Shows login prompt with standard and IDP login options, or redirects to projects.
 */
export default function TenantHomePage() {
  const { isAuthenticated, isLoading, error, login, loginWithIdp, tenant } = useAuth();

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
    const hasExternalIdps = tenant?.identityProviders && tenant.identityProviders.length > 0;

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

            {/* Standard Sign In Button */}
            <button onClick={login} className="w-full btn btn-primary py-3">
              Sign In
            </button>

            {/* External IDP Buttons */}
            {hasExternalIdps && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {tenant.identityProviders!.map((idp) => (
                    <button
                      key={idp.alias}
                      onClick={() => loginWithIdp(idp.alias)}
                      className="w-full btn btn-secondary py-3 flex items-center justify-center gap-2"
                    >
                      <ExternalIdpIcon />
                      <span>{idp.displayName}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

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
