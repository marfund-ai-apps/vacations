import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewRequest from './pages/NewRequest';
import MyRequests from './pages/MyRequests';
import PendingApprovals from './pages/PendingApprovals';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import AllRequests from './pages/AllRequests';
import Profile from './pages/Profile';
import InactiveUsers from './pages/InactiveUsers';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/new-request" element={<NewRequest />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/pending-approvals" element={<PendingApprovals />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />

          {/* Admin routes, only visible to super_admin and hr_admin */}
          <Route element={<ProtectedRoute roles={['super_admin', 'hr_admin']} />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/all-requests" element={<AllRequests />} />
          </Route>

          <Route element={<ProtectedRoute roles={['super_admin']} />}>
            <Route path="/admin/inactive" element={<InactiveUsers />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
