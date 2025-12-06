'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Main layout component with navigation and header.
 */
export default function Layout({ children }: LayoutProps) {
  const { user, tenant, isAuthenticated, logout, hasRole } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and main nav */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href={`/${tenant?.slug || ''}`} className="text-xl font-bold text-primary-600">
                  TaskHub
                </Link>
                {tenant && (
                  <span className="ml-2 text-sm text-gray-500">
                    {tenant.name}
                  </span>
                )}
              </div>

              {isAuthenticated && (
                <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                  <Link
                    href={`/${tenant?.slug}/projects`}
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-primary-500"
                  >
                    Projects
                  </Link>
                  {hasRole('admin') && (
                    <Link
                      href={`/${tenant?.slug}/settings`}
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:border-primary-500 hover:text-gray-900"
                    >
                      Settings
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center">
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-4">
                  <div className="text-sm">
                    <span className="text-gray-700">{user.name || user.email}</span>
                    <div className="flex gap-1 mt-0.5">
                      {user.roles
                        .filter((r) => ['admin', 'manager', 'member'].includes(r))
                        .map((role) => (
                          <span
                            key={role}
                            className="badge badge-blue text-xs"
                          >
                            {role}
                          </span>
                        ))}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="btn btn-secondary text-sm"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            TaskHub - Multi-Tenant SaaS Demo
          </p>
        </div>
      </footer>
    </div>
  );
}
