import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DEFAULT_ROLES, DEFAULT_SETTINGS, INITIAL_AUDIT_EVENTS } from '../data/adminData.js';

const AdminContext = createContext(null);
let nextAuditId = 129;

export function AdminProvider() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [auditEvents, setAuditEvents] = useState(INITIAL_AUDIT_EVENTS);

  const recordAudit = useCallback((event) => {
    const entry = {
      id: `AUD-2026-${String(nextAuditId++).padStart(5, '0')}`,
      timestamp: new Date().toISOString(),
      actor: 'Super Admin',
      outcome: 'Simulated',
      ...event,
    };
    setAuditEvents((items) => [entry, ...items]);
  }, []);

  const updateSettings = useCallback((nextSettings) => {
    setSettings(nextSettings);
  }, []);

  const updateRolePermission = useCallback((roleId, permission, enabled) => {
    setRoles((items) => items.map((role) => role.id === roleId && !role.locked
      ? { ...role, permissions: { ...role.permissions, [permission]: enabled } }
      : role));
  }, []);

  const addRole = useCallback((role) => {
    setRoles((items) => [{ ...role, id: `ROLE-${String(Date.now()).slice(-5)}`, users: 0, locked: false }, ...items]);
  }, []);

  const value = useMemo(() => ({
    settings,
    roles,
    auditEvents,
    updateSettings,
    updateRolePermission,
    addRole,
    recordAudit,
  }), [settings, roles, auditEvents, updateSettings, updateRolePermission, addRole, recordAudit]);

  return <AdminContext.Provider value={value}><Outlet /></AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
}
