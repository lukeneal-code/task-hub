import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import TenantList from './pages/TenantList';
import TenantCreate from './pages/TenantCreate';
import TenantDetail from './pages/TenantDetail';
import UserCreate from './pages/UserCreate';

const styles = {
  app: {
    minHeight: '100vh',
  },
  nav: {
    backgroundColor: '#1a1a2e',
    padding: '1rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  logo: {
    color: 'white',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textDecoration: 'none',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
  },
  main: {
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
};

function App() {
  return (
    <BrowserRouter>
      <div style={styles.app}>
        <nav style={styles.nav}>
          <Link to="/" style={styles.logo}>TaskHub Admin</Link>
          <Link to="/" style={styles.navLink}>Tenants</Link>
        </nav>
        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<TenantList />} />
            <Route path="/tenants/new" element={<TenantCreate />} />
            <Route path="/tenants/:id" element={<TenantDetail />} />
            <Route path="/tenants/:tenantId/users/new" element={<UserCreate />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
