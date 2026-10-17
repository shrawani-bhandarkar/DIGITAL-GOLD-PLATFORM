import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DEFAULT_ROLES, DEFAULT_SETTINGS, INITIAL_AUDIT_EVENTS, PERMISSION_GROUPS } from '../data/adminData.js';
import { useAuth } from './AuthContext.jsx';

const AdminContext = createContext(null);
const PERMISSION_STORAGE_KEY = 'digital-gold-demo-admin-permissions';
let nextAuditId = 129;

function readRoles() {
  const roles = DEFAULT_ROLES.map((role) => ({ ...role, permissions: { ...role.permissions } }));
  try {
    const stored = JSON.parse(window.localStorage.getItem(PERMISSION_STORAGE_KEY) ?? 'null');
    if (stored && typeof stored === 'object') {
      const admin = roles.find((role) => role.id === 'ADMIN');
      admin.permissions = Object.fromEntries(PERMISSION_GROUPS.map(({ key }) => [key, false]));
      for (const { key } of PERMISSION_GROUPS) {
        if (typeof stored[key] === 'boolean') admin.permissions[key] = stored[key];
      }
    }
  } catch {
    // Invalid demo preferences are ignored; the configured defaults remain least-privileged.
  }
  return roles;
}

export function AdminProvider() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [roles, setRoles] = useState(readRoles);
  const activeRoleId = user?.roleId;
  const [auditEvents, setAuditEvents] = useState(INITIAL_AUDIT_EVENTS);

  const recordAudit = useCallback((event) => {
    const actor = roles.find((role) => role.id === activeRoleId)?.name ?? 'Super Admin';
    const entry = {
      id: `AUD-2026-${String(nextAuditId++).padStart(5, '0')}`,
      timestamp: new Date().toISOString(),
      actor,
      outcome: 'Simulated',
      ...event,
    };
    setAuditEvents((items) => [entry, ...items]);
  }, [activeRoleId, roles]);

  const updateSettings = useCallback((nextSettings) => {
    setSettings(nextSettings);
  }, []);

  const saveAdminPermissions = useCallback((permissions) => {
    if (activeRoleId !== 'SUPER_ADMIN') return { success: false, message: 'Only Super Admin can configure Admin permissions.' };
    if (!PERMISSION_GROUPS.every(({ key }) => typeof permissions[key] === 'boolean')) {
      return { success: false, message: 'Every Admin permission must be explicitly enabled or disabled.' };
    }
    const nextRoles = roles.map((role) => role.id === 'ADMIN'
      ? { ...role, permissions: Object.fromEntries(PERMISSION_GROUPS.map(({ key }) => [key, permissions[key]])) }
      : role);
    try {
      window.localStorage.setItem(PERMISSION_STORAGE_KEY, JSON.stringify(nextRoles.find((role) => role.id === 'ADMIN').permissions));
    } catch {
      return { success: false, message: 'Could not save demo Admin permissions in this browser.' };
    }
    setRoles(nextRoles);
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
