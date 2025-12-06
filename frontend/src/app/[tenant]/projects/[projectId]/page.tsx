'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import Layout from '@/components/Layout';
import TaskBoard from '@/components/TaskBoard';
import CreateTaskModal from '@/components/CreateTaskModal';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Task } from '@/types';

/**
 * Project detail page with task board.
 */
export default function ProjectPage({
  params,
}: {
  params: { tenant: string; projectId: string };
}) {
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(params.projectId);
  const { data: tasksData, isLoading: tasksLoading } = useTasks(params.projectId);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  if (authLoading || projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading project..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
          <button onClick={login} className="btn btn-primary">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <Layout>
        <div className="card text-center py-12">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Project Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The project you're looking for doesn't exist or you don't have access.
          </p>
          <Link href={`/${params.tenant}/projects`} className="btn btn-primary">
            Back to Projects
          </Link>
        </div>
      </Layout>
    );
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // Could open a task detail modal here
    console.log('Task clicked:', task);
  };

  return (
    <Layout>
      {/* Project Header */}
      <div className="mb-6">
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <Link
            href={`/${params.tenant}/projects`}
            className="hover:text-primary-600"
          >
            Projects
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{project.name}</span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
          </div>

          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="btn btn-primary"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Task Board */}
      {tasksLoading ? (
        <LoadingSpinner message="Loading tasks..." />
      ) : (
        <TaskBoard
          tasks={tasksData?.data || []}
          onTaskClick={handleTaskClick}
        />
      )}

      <CreateTaskModal
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        projectId={params.projectId}
      />
    </Layout>
  );
}
