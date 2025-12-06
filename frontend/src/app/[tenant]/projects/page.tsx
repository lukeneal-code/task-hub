'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import Layout from '@/components/Layout';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/CreateProjectModal';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Projects list page.
 * Shows all projects in the tenant.
 */
export default function ProjectsPage({
  params,
}: {
  params: { tenant: string };
}) {
  const { isAuthenticated, isLoading: authLoading, hasRole, login } = useAuth();
  const { data, isLoading, error } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-4">
            Please sign in to view projects.
          </p>
          <button onClick={login} className="btn btn-primary">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const canCreateProject = hasRole('admin') || hasRole('manager');

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">
            Manage your team's projects and tasks
          </p>
        </div>

        {canCreateProject && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            + New Project
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading projects..." />
      ) : error ? (
        <div className="card text-center">
          <p className="text-red-600">Failed to load projects</p>
          <p className="text-gray-500 text-sm mt-1">
            {(error as Error).message}
          </p>
        </div>
      ) : data?.data.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-gray-400 text-5xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No projects yet
          </h3>
          <p className="text-gray-600 mb-4">
            {canCreateProject
              ? 'Get started by creating your first project.'
              : 'Projects will appear here once they are created.'}
          </p>
          {canCreateProject && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.data.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              tenantSlug={params.tenant}
            />
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </Layout>
  );
}
