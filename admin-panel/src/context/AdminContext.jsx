import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DEFAULT_ROLES, DEFAULT_SETTINGS, INITIAL_AUDIT_EVENTS, PERMISSION_GROUPS } from '../data/adminData.js';

const AdminContext = createContext(null);
let nextAuditId = 129;

export function AdminProvider() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [activeRoleId, setActiveRoleId] = useState('SUPER_ADMIN');
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

  const updateRolePermission = useCallback((roleId, permission, enabled) => {
    if (activeRoleId !== 'SUPER_ADMIN' || roleId !== 'ADMIN' || !PERMISSION_GROUPS.some((item) => item.key === permission)) return;
    setRoles((items) => items.map((role) => role.id === roleId
      ? { ...role, permissions: { ...role.permissions, [permission]: enabled } }
      : role));
  }, [activeRoleId]);

  const setDemoRole = useCallback((roleId) => {
    if (activeRoleId !== 'SUPER_ADMIN' || !['SUPER_ADMIN', 'ADMIN'].includes(roleId)) return false;
    setActiveRoleId(roleId);
    return true;
  }, [activeRoleId]);

  const activeRole = roles.find((role) => role.id === activeRoleId) ?? roles[0];
  const hasPermission = useCallback((permission) => (
    activeRoleId === 'SUPER_ADMIN' || Boolean(activeRole?.permissions[permission])
  ), [activeRoleId, activeRole]);

  const value = useMemo(() => ({
    settings,
    roles,
    activeRole,
    activeRoleId,
    hasPermission,
    auditEvents,
    setDemoRole,
    updateSettings,
    updateRolePermission,
    recordAudit,
  }), [settings, roles, activeRole, activeRoleId, hasPermission, auditEvents, setDemoRole, updateSettings, updateRolePermission, recordAudit]);

  return <AdminContext.Provider value={value}><Outlet /></AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
}
