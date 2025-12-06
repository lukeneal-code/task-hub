'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { api } from '@/services/api';

/**
 * Tenant Settings Page
 * Only accessible by tenant admins.
 */
export default function SettingsPage() {
  const { isAuthenticated, isLoading, tenant, hasRole } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading settings..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Please sign in to access settings.</p>
        </div>
      </Layout>
    );
  }

  if (!hasRole('admin')) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Organization Settings</h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Organization Info */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization Name</label>
              <p className="mt-1 text-gray-900">{tenant?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <p className="mt-1 text-gray-900">{tenant?.slug}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tenant ID</label>
              <p className="mt-1 text-gray-500 text-sm font-mono">{tenant?.id}</p>
            </div>
          </div>
        </div>

        {/* Authentication Settings */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Authentication</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Keycloak Realm</label>
              <p className="mt-1 text-gray-900">{tenant?.realm}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">SSO Provider</label>
              <p className="mt-1 text-gray-900">Keycloak</p>
            </div>
            <p className="text-sm text-gray-500">
              To configure additional identity providers or authentication policies, access the{' '}
              <a
                href={`${process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080'}/admin/${tenant?.realm}/console`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700"
              >
                Keycloak Admin Console
              </a>
              .
            </p>
          </div>
        </div>

        {/* Security & Compliance */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Security & Compliance</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Audit Logging</p>
                <p className="text-sm text-gray-500">All security events are logged for SOC2 compliance</p>
              </div>
              <span className="badge badge-green">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Data Isolation</p>
                <p className="text-sm text-gray-500">Schema-per-tenant database isolation for GDPR compliance</p>
              </div>
              <span className="badge badge-green">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Role-Based Access Control</p>
                <p className="text-sm text-gray-500">Admin, Manager, and Member roles with hierarchical permissions</p>
              </div>
              <span className="badge badge-green">Configured</span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card border-red-200 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800 mb-4">Danger Zone</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Export Organization Data</p>
                <p className="text-sm text-gray-500">Download all organization data (GDPR data portability)</p>
              </div>
              <button className="btn btn-secondary text-sm" disabled>
                Export Data
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Delete Organization</p>
                <p className="text-sm text-gray-500">Permanently delete this organization and all data</p>
              </div>
              <button className="btn text-sm bg-red-600 text-white hover:bg-red-700" disabled>
                Delete Organization
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Destructive operations are disabled in this demo. Contact platform support for assistance.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
