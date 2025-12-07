import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { tenantApi, userApi, User } from '../services/api';

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
  backLink: {
    color: '#6b7280',
    textDecoration: 'none',
    marginBottom: '1rem',
    display: 'block',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  field: {
    marginBottom: '0.75rem',
  },
  label: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
  },
  value: {
    fontWeight: '500',
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
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.75rem',
    borderBottom: '1px solid #e5e7eb',
    fontWeight: '600',
    fontSize: '0.875rem',
  },
  td: {
    padding: '0.75rem',
    borderBottom: '1px solid #e5e7eb',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#666',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    backgroundColor: '#f3f4f6',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
  },
};

function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantApi.get(id!),
    enabled: !!id,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.list(id!),
    enabled: !!id,
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => userApi.delete(id!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', id] }),
  });

  const handleDeleteUser = (user: User) => {
    if (confirm(`Delete user "${user.email}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  if (tenantLoading) return <div style={styles.loading}>Loading tenant...</div>;
  if (!tenant) return <div style={styles.loading}>Tenant not found</div>;

  return (
    <div>
      <Link to="/" style={styles.backLink}>&larr; Back to Tenants</Link>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{tenant.name}</h1>
          <span style={{ ...styles.badge, ...styles.badgeActive }}>{tenant.status}</span>
        </div>
        <Link
          to={`/tenants/${id}/users/new`}
          style={styles.button}
        >
          Add User
        </Link>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Tenant Information</h2>
        <div style={styles.grid}>
          <div style={styles.field}>
            <div style={styles.label}>Slug</div>
            <div style={styles.value}>{tenant.slug}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Schema</div>
            <div style={styles.value}><code style={styles.mono}>{tenant.schema_name}</code></div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Created</div>
            <div style={styles.value}>{new Date(tenant.created_at).toLocaleString()}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.label}>Updated</div>
            <div style={styles.value}>{new Date(tenant.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={styles.cardTitle}>Users ({usersData?.total ?? 0})</h2>
        </div>

        {usersLoading ? (
          <div style={styles.loading}>Loading users...</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersData?.data.map((user) => (
                <tr key={user.id}>
                  <td style={styles.td}>{user.email}</td>
                  <td style={styles.td}>{user.first_name} {user.last_name}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        backgroundColor: user.role === 'admin' ? '#fef3c7' : '#e0e7ff',
                        color: user.role === 'admin' ? '#92400e' : '#3730a3',
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...styles.badgeActive }}>{user.status}</span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.button, ...styles.buttonSmall, ...styles.buttonDanger }}
                      onClick={() => handleDeleteUser(user)}
                      disabled={deleteUserMutation.isPending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {usersData?.data.length === 0 && (
          <div style={styles.loading}>No users yet.</div>
        )}
      </div>
    </div>
  );
}

export default TenantDetail;
