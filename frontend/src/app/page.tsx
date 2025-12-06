'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Landing page - tenant selection.
 * Users enter their organization slug to access their tenant.
 */
export default function LandingPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantSlug.trim()) {
      setError('Please enter your organization name');
      return;
    }

    // Navigate to tenant-specific page
    router.push(`/${tenantSlug.trim().toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TaskHub</h1>
          <p className="text-primary-200">
            Multi-Tenant Project Management Platform
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            Sign in to your organization
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="tenant"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Organization Name
              </label>
              <div className="flex">
                <input
                  type="text"
                  id="tenant"
                  value={tenantSlug}
                  onChange={(e) => {
                    setTenantSlug(e.target.value);
                    setError('');
                  }}
                  className="input rounded-r-none"
                  placeholder="your-company"
                />
                <span className="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-lg">
                  .taskhub.io
                </span>
              </div>
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full btn btn-primary py-3 text-lg"
            >
              Continue
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Demo tenant:{' '}
              <button
                onClick={() => router.push('/demo')}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                demo
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-primary-200 text-sm">
          <p>Demonstrating enterprise-grade IAM concepts:</p>
          <ul className="mt-2 space-y-1">
            <li>Multi-tenant Keycloak realm isolation</li>
            <li>Role-based access control (RBAC)</li>
            <li>Schema-per-tenant data separation</li>
            <li>SOC2 compliant audit logging</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
