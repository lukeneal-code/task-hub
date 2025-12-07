import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { userApi, CreateUserRequest } from '../services/api';

const styles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    maxWidth: '600px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
  },
  backLink: {
    color: '#6b7280',
    textDecoration: 'none',
    marginBottom: '1rem',
    display: 'block',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  field: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '1rem',
  },
  checkboxGroup: {
    display: 'flex',
    gap: '1.5rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  },
  checkbox: {
    width: '1.25rem',
    height: '1.25rem',
  },
  button: {
    backgroundColor: '#4f46e5',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  buttonSecondary: {
    backgroundColor: '#6b7280',
    marginLeft: '1rem',
  },
  error: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    padding: '1rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
};

const AVAILABLE_ROLES = ['admin', 'manager', 'member'];

function UserCreate() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    roles: ['member'] as string[],
  });

  const mutation = useMutation({
    mutationFn: (data: CreateUserRequest) => userApi.create(tenantId!, data),
    onSuccess: () => {
      navigate(`/tenants/${tenantId}`);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (role: string) => {
    setFormData((prev) => {
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles: roles.length > 0 ? roles : ['member'] };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div>
      <Link to={`/tenants/${tenantId}`} style={styles.backLink}>
        &larr; Back to Tenant
      </Link>

      <div style={styles.card}>
        <h1 style={styles.title}>Add User</h1>

        {mutation.error && (
          <div style={styles.error}>
            {(mutation.error as Error).message || 'Failed to create user'}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>First Name</label>
              <input
                style={styles.input}
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                maxLength={100}
              />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Last Name</label>
              <input
                style={styles.input}
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                maxLength={100}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
            />
            <div style={styles.hint}>
              Minimum 8 characters with uppercase, lowercase, number, and symbol
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Roles</label>
            <div style={styles.checkboxGroup}>
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={formData.roles.includes(role)}
                    onChange={() => handleRoleChange(role)}
                  />
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div>
            <button
              type="submit"
              style={{
                ...styles.button,
                ...(mutation.isPending ? styles.buttonDisabled : {}),
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => navigate(`/tenants/${tenantId}`)}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserCreate;
