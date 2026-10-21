import { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, LockKeyhole, Save, ShieldCheck, X } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { PERMISSION_GROUPS } from '../data/adminData.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export default function RolesPermissionsPage() {
  useDocumentTitle('Roles & permissions');
  const { roles, activeRoleId, hasPermission, saveAdminPermissions, recordAudit } = useAdmin();
  const [selectedRoleId, setSelectedRoleId] = useState('ADMIN');
  const [draftPermissions, setDraftPermissions] = useState({});
  const [confirmSave, setConfirmSave] = useState(false);
  const [saveError, setSaveError] = useState('');
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const canManage = activeRoleId === 'SUPER_ADMIN' && hasPermission('administration');
  const assignedUsers = useMemo(() => roles.reduce((sum, role) => sum + role.users, 0), [roles]);
  const adminRole = roles.find((role) => role.id === 'ADMIN');
  const isDirty = Boolean(adminRole && PERMISSION_GROUPS.some(({ key }) => draftPermissions[key] !== adminRole.permissions[key]));

  useEffect(() => {
    if (adminRole) setDraftPermissions({ ...adminRole.permissions });
  }, [adminRole]);

  function cancelChanges() {
    if (adminRole) setDraftPermissions({ ...adminRole.permissions });
  }

  async function saveChanges() {
    const changed = PERMISSION_GROUPS.filter(({ key }) => draftPermissions[key] !== adminRole.permissions[key]);
    const result = await saveAdminPermissions(draftPermissions);
    if (!result.success) {
      setSaveError(result.message);
      setConfirmSave(false);
      return;
    }
    if (changed.length) {
      recordAudit({
        action: 'Updated Admin role permissions',
        category: 'Administration',
        target: 'Admin',
        detail: `Updated demo permissions: ${changed.map(({ label }) => label).join(', ')}.`,
      });
    }
    setSaveError('');
    setConfirmSave(false);
  }

  function togglePermission(permission) {
    if (!canManage || selectedRoleId !== 'ADMIN') return;
    setDraftPermissions((current) => ({ ...current, [permission]: !current[permission] }));
  }

  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION" title="Roles & permissions" description="Manage Admin permissions enforced by the API." />
      {saveError && <p className="form-feedback" role="alert">{saveError}</p>}
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><KeyRound size={17} /></span><div><span>Configured roles</span><strong>{roles.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><ShieldCheck size={17} /></span><div><span>Assigned demo users</span><strong>{assignedUsers}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><LockKeyhole size={17} /></span><div><span>Highest-privilege role</span><strong>Super Admin</strong></div></article>
      </section>
      <div className="roles-layout">
        <section className="panel role-list-panel" aria-label="Available roles">
          <div className="panel-heading"><div><h2>Available roles</h2><p>Only Super Admin and Admin are supported.</p></div></div>
          <div className="role-list">
            {roles.map((role) => (
              <button className={`role-list-item ${role.id === selectedRole?.id ? 'selected' : ''}`} key={role.id} onClick={() => setSelectedRoleId(role.id)} aria-pressed={role.id === selectedRole?.id}>
                <span className="role-avatar"><KeyRound size={15} /></span>
                <span><strong>{role.name}</strong><small>{role.users} assigned · {role.description}</small></span>
                {role.id === 'SUPER_ADMIN' && <LockKeyhole size={14} className="role-locked-icon" aria-label="Highest privilege role" />}
              </button>
            ))}
          </div>
        </section>
        <section className="panel permissions-panel" aria-labelledby="permission-heading">
          <div className="panel-heading">
            <div><h2 id="permission-heading">{selectedRole?.name ?? 'Role permissions'}</h2><p>{selectedRole?.description}</p></div>
            {selectedRole?.id === 'SUPER_ADMIN' && <span className="role-protected-label"><ShieldCheck size={12} /> Highest privilege</span>}
          </div>
          <div className="permission-table-scroll">
            <table className="permission-table">
              <thead><tr><th scope="col">Feature area</th><th scope="col">Access</th></tr></thead>
              <tbody>{PERMISSION_GROUPS.map(({ key, label }) => {
                const enabled = selectedRole?.id === 'ADMIN' ? Boolean(draftPermissions[key]) : Boolean(selectedRole?.permissions[key]);
                return <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>
                    <button
                      className={`permission-toggle ${enabled ? 'enabled' : ''}`}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${label} access ${enabled ? 'enabled' : 'disabled'}${selectedRole?.id === 'SUPER_ADMIN' ? ' (always enabled)' : canManage ? '' : ' (read only)'}`}
                      disabled={!canManage || selectedRole?.id !== 'ADMIN'}
                      onClick={() => togglePermission(key)}
                    >
                      <span />{enabled ? <Check size={12} /> : <X size={12} />}<span className="permission-toggle-label">{enabled ? 'Enabled' : 'Disabled'}</span>
                    </button>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="permission-footnote"><LockKeyhole size={13} /> Super Admin always retains full access. Only Super Admin can configure Admin permissions.</div>
          {canManage && selectedRole?.id === 'ADMIN' && <div className="form-actions permission-actions">
            <button type="button" className="button button-secondary" onClick={cancelChanges} disabled={!isDirty}>Cancel</button>
            <button type="button" className="button button-primary" onClick={() => setConfirmSave(true)} disabled={!isDirty}><Save size={14} /> Save permissions</button>
          </div>}
        </section>
      </div>
      <ConfirmDialog
        open={confirmSave}
        title="Save Admin permissions?"
        description="These changes update the Admin role's permissions in this frontend demo session. They do not configure backend authorization."
        confirmLabel="Save permissions"
        onCancel={() => setConfirmSave(false)}
        onConfirm={saveChanges}
      />
    </>
  );
}
