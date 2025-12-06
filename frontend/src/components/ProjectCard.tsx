'use client';

import Link from 'next/link';
import type { Project } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectCardProps {
  project: Project;
  tenantSlug: string;
}

/**
 * Project card component for the project list.
 */
export default function ProjectCard({ project, tenantSlug }: ProjectCardProps) {
  const { hasRole } = useAuth();

  const statusColors = {
    active: 'badge-green',
    archived: 'badge-gray',
    completed: 'badge-blue',
  };

  return (
    <div className="card hover:shadow-lg transition-shadow duration-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Link
            href={`/${tenantSlug}/projects/${project.id}`}
            className="text-lg font-semibold text-gray-900 hover:text-primary-600"
          >
            {project.name}
          </Link>
          <span className={`badge ${statusColors[project.status]} ml-2`}>
            {project.status}
          </span>
        </div>
      </div>

      {project.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>
          Created {new Date(project.created_at).toLocaleDateString()}
        </span>
        <Link
          href={`/${tenantSlug}/projects/${project.id}`}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          View tasks &rarr;
        </Link>
      </div>
    </div>
  );
}
