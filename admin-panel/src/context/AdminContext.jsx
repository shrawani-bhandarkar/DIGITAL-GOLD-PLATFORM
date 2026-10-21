import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DEFAULT_ROLES, DEFAULT_SETTINGS, PERMISSION_GROUPS } from '../data/adminData.js';
import { useAuth } from './AuthContext.jsx';
import { apiRequest } from '../services/apiClient.js';

const AdminContext = createContext(null);

export function AdminProvider() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [roles, setRoles] = useState(() => DEFAULT_ROLES.map((role) => ({ ...role, permissions: { ...role.permissions } })));
  const activeRoleId = user?.roleId;
  const [auditEvents, setAuditEvents] = useState([]);
  const [persistenceError, setPersistenceError] = useState('');
  const [consoleState, setConsoleState] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiRequest('/api/admin/console/state')
      .then((state) => {
        if (!mounted) return;
        setConsoleState(state);
        if (state.settings) setSettings(state.settings);
        setAuditEvents(state.auditEvents ?? []);
        if (state.roleCounts) {
          setRoles((current) => current.map((role) => ({ ...role, users: Number(state.roleCounts[role.id] ?? role.users) })));
        }
        const permissions = Object.fromEntries((state.rolePermissions ?? [])
          .filter((item) => item.role_id === 'ADMIN')
          .map((item) => [item.permission_key, Boolean(item.allowed)]));
        if (Object.keys(permissions).length) {
          setRoles((current) => current.map((role) => role.id === 'ADMIN'
            ? { ...role, permissions: { ...role.permissions, ...permissions } }
            : role));
        }
      })
      .catch((error) => { if (mounted) setPersistenceError(error.message); });
    return () => { mounted = false; };
  }, []);

  const recordAudit = useCallback((event) => {
    const actor = roles.find((role) => role.id === activeRoleId)?.name ?? 'Super Admin';
    const entry = {
      id: `AUD-${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      actor,
      outcome: 'Completed',
      ...event,
    };
    setAuditEvents((items) => [entry, ...items]);
    apiRequest('/api/admin/console/audit-events', { method: 'POST', body: entry })
      .catch((error) => setPersistenceError(error.message));
  }, [activeRoleId, roles]);

  const updateSettings = useCallback(async (nextSettings) => {
    try {
      await apiRequest('/api/admin/console/settings', { method: 'PUT', body: nextSettings });
      setSettings(nextSettings);
      setPersistenceError('');
      return { success: true };
    } catch (error) {
      setPersistenceError(error.message);
      return { success: false, message: error.message };
    }
  }, []);

  const saveAdminPermissions = useCallback(async (permissions) => {
    if (activeRoleId !== 'SUPER_ADMIN') return { success: false, message: 'Only Super Admin can configure Admin permissions.' };
    if (!PERMISSION_GROUPS.every(({ key }) => typeof permissions[key] === 'boolean')) {
      return { success: false, message: 'Every Admin permission must be explicitly enabled or disabled.' };
    }
    const nextRoles = roles.map((role) => role.id === 'ADMIN'
      ? { ...role, permissions: Object.fromEntries(PERMISSION_GROUPS.map(({ key }) => [key, permissions[key]])) }
      : role);
    try {
      await apiRequest('/api/admin/console/roles/ADMIN/permissions', { method: 'PUT', body: permissions });
    } catch (error) {
      setPersistenceError(error.message);
      return { success: false, message: error.message };
    }
    setRoles(nextRoles);
    setPersistenceError('');
    return { success: true };
  }, [activeRoleId, roles]);

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? null;
  const hasPermission = useCallback((permission) => (
    Boolean(activeRole?.permissions[permission])
  ), [activeRole]);

  const value = useMemo(() => ({
    settings,
    roles,
    activeRole,
    activeRoleId,
    hasPermission,
    auditEvents,
    consoleState,
    persistenceError,
    setPersistenceError,
    updateSettings,
    saveAdminPermissions,
    recordAudit,
  }), [settings, roles, activeRole, activeRoleId, hasPermission, auditEvents, updateSettings, saveAdminPermissions, recordAudit]);

  return <AdminContext.Provider value={value}><Outlet /></AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
}
