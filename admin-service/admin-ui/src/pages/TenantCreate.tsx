import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { tenantApi, CreateTenantRequest } from '../services/api';

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
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  },
  section: {
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#374151',
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

function TenantCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateTenantRequest>({
    name: '',
    slug: '',
    admin_email: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_password: '',
  });

  const mutation = useMutation({
    mutationFn: (data: CreateTenantRequest) => tenantApi.create(data),
    onSuccess: (tenant) => {
      navigate(`/tenants/${tenant.id}`);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-generate slug from name
      if (name === 'name') {
        updated.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div style={styles.card}>
      <h1 style={styles.title}>Create Tenant</h1>

      {mutation.error && (
        <div style={styles.error}>
          {(mutation.error as Error).message || 'Failed to create tenant'}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Organization Details</h3>
          <div style={styles.field}>
            <label style={styles.label}>Organization Name</label>
            <input
              style={styles.input}
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={255}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Slug</label>
            <input
              style={styles.input}
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              required
              pattern="[a-z0-9-]+"
              minLength={2}
              maxLength={100}
            />
            <div style={styles.hint}>URL-friendly identifier (lowercase letters, numbers, hyphens)</div>
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Initial Admin User</h3>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              name="admin_email"
              value={formData.admin_email}
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
                name="admin_first_name"
                value={formData.admin_first_name}
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
                name="admin_last_name"
                value={formData.admin_last_name}
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
              name="admin_password"
              value={formData.admin_password}
              onChange={handleChange}
              required
              minLength={8}
            />
            <div style={styles.hint}>
              Minimum 8 characters with uppercase, lowercase, number, and symbol
            </div>
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
            {mutation.isPending ? 'Creating...' : 'Create Tenant'}
          </button>
          <button
            type="button"
            style={{ ...styles.button, ...styles.buttonSecondary }}
            onClick={() => navigate('/')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default TenantCreate;
