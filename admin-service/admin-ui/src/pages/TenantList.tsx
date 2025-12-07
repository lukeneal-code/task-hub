import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { tenantApi, Tenant } from '../services/api';

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#4f46e5',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  buttonSmall: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    marginLeft: '0.5rem',
  },
  buttonDanger: {
    backgroundColor: '#dc2626',
  },
  buttonWarning: {
    backgroundColor: '#f59e0b',
  },
  buttonSuccess: {
    backgroundColor: '#10b981',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  th: {
    textAlign: 'left' as const,
    padding: '1rem',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: '600',
  },
  td: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  badgeActive: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  badgeSuspended: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  link: {
    color: '#4f46e5',
    textDecoration: 'none',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#666',
  },
};

function TenantList() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantApi.list(),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => tenantApi.suspend(id, 'Suspended by admin'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => tenantApi.reactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] }),
  });

  const handleDelete = (tenant: Tenant) => {
    if (confirm(`Delete tenant "${tenant.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(tenant.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const badgeStyle = {
      ...styles.badge,
      ...(status === 'active' ? styles.badgeActive : {}),
      ...(status === 'suspended' ? styles.badgeSuspended : {}),
      ...(status === 'pending' ? styles.badgePending : {}),
    };
    return <span style={badgeStyle}>{status}</span>;
  };

  if (isLoading) return <div style={styles.loading}>Loading tenants...</div>;
  if (error) return <div style={styles.loading}>Error loading tenants</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Tenants</h1>
        <Link to="/tenants/new" style={styles.button}>
          Create Tenant
        </Link>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Slug</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Users</th>
            <th style={styles.th}>Created</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.data.map((tenant) => (
            <tr key={tenant.id}>
              <td style={styles.td}>
                <Link to={`/tenants/${tenant.id}`} style={styles.link}>
                  {tenant.name}
                </Link>
              </td>
              <td style={styles.td}>{tenant.slug}</td>
              <td style={styles.td}>{getStatusBadge(tenant.status)}</td>
              <td style={styles.td}>{tenant.user_count ?? 0}</td>
              <td style={styles.td}>
                {new Date(tenant.created_at).toLocaleDateString()}
              </td>
              <td style={styles.td}>
                {tenant.status === 'active' ? (
                  <button
                    style={{ ...styles.button, ...styles.buttonSmall, ...styles.buttonWarning }}
                    onClick={() => suspendMutation.mutate(tenant.id)}
                    disabled={suspendMutation.isPending}
                  >
                    Suspend
                  </button>
                ) : tenant.status === 'suspended' ? (
                  <button
                    style={{ ...styles.button, ...styles.buttonSmall, ...styles.buttonSuccess }}
                    onClick={() => reactivateMutation.mutate(tenant.id)}
                    disabled={reactivateMutation.isPending}
                  >
                    Reactivate
                  </button>
                ) : null}
                <button
                  style={{ ...styles.button, ...styles.buttonSmall, ...styles.buttonDanger }}
                  onClick={() => handleDelete(tenant)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data?.data.length === 0 && (
        <div style={styles.loading}>
          No tenants yet. Create your first tenant to get started.
        </div>
      )}
    </div>
  );
}

export default TenantList;
