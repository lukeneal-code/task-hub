'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/types';
import { useUpdateTask } from '@/hooks/useTasks';
import clsx from 'clsx';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const columns: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'todo', title: 'To Do', color: 'bg-gray-100' },
  { status: 'in_progress', title: 'In Progress', color: 'bg-blue-50' },
  { status: 'review', title: 'Review', color: 'bg-yellow-50' },
  { status: 'done', title: 'Done', color: 'bg-green-50' },
];

const priorityColors = {
  low: 'border-l-gray-400',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

/**
 * Kanban-style task board component.
 */
export default function TaskBoard({ tasks, onTaskClick }: TaskBoardProps) {
  const updateTask = useUpdateTask();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (status: TaskStatus) => {
    if (draggedTask && draggedTask.status !== status) {
      updateTask.mutate({
        id: draggedTask.id,
        data: { status },
      });
    }
    setDraggedTask(null);
  };

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((column) => (
        <div
          key={column.status}
          className={clsx('rounded-lg p-4 min-h-[400px]', column.color)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(column.status)}
        >
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center justify-between">
            {column.title}
            <span className="bg-white px-2 py-0.5 rounded-full text-sm">
              {getTasksByStatus(column.status).length}
            </span>
          </h3>

          <div className="space-y-3">
            {getTasksByStatus(column.status).map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => handleDragStart(task)}
                onClick={() => onTaskClick(task)}
                className={clsx(
                  'bg-white rounded-lg shadow p-3 cursor-pointer',
                  'hover:shadow-md transition-shadow duration-200',
                  'border-l-4',
                  priorityColors[task.priority]
                )}
              >
                <h4 className="font-medium text-gray-900 text-sm mb-1">
                  {task.title}
                </h4>

                {task.description && (
                  <p className="text-gray-500 text-xs line-clamp-2 mb-2">
                    {task.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span
                    className={clsx('badge', {
                      'badge-gray': task.priority === 'low',
                      'badge-blue': task.priority === 'medium',
                      'badge-yellow': task.priority === 'high',
                      'badge-red': task.priority === 'urgent',
                    })}
                  >
                    {task.priority}
                  </span>

                  {task.due_date && (
                    <span className="text-gray-400">
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
