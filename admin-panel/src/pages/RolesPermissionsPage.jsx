import { useMemo, useState } from 'react';
import { Check, KeyRound, LockKeyhole, Plus, ShieldCheck, X } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import SimulatedBanner from '../components/SimulatedBanner.jsx';
import { useAdmin } from '../context/AdminContext.jsx';
import { PERMISSION_GROUPS } from '../data/adminData.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export default function RolesPermissionsPage() {
  useDocumentTitle('Roles & permissions');
  const { roles, updateRolePermission, addRole, recordAudit } = useAdmin();
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];
  const assignedUsers = useMemo(() => roles.reduce((sum, role) => sum + role.users, 0), [roles]);

  function submitRole(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const name = values.name.trim();
    if (roles.some((role) => role.name.toLowerCase() === name.toLowerCase())) {
      setFormError('A role with this name already exists.');
      return;
    }
    addRole({
      name,
      description: values.description.trim(),
      permissions: Object.fromEntries(PERMISSION_GROUPS.map(({ key }) => [key, false])),
    });
    recordAudit({ action: 'Created admin role', category: 'Administration', target: name, detail: 'New role created with no permissions enabled.' });
    setModalOpen(false);
    setFormError('');
    form.reset();
  }

  function togglePermission(permission, enabled) {
    if (!selectedRole || selectedRole.locked) return;
    updateRolePermission(selectedRole.id, permission, enabled);
    recordAudit({
      action: `${enabled ? 'Granted' : 'Revoked'} role permission`,
      category: 'Administration',
      target: selectedRole.name,
      detail: `${permission} permission ${enabled ? 'enabled' : 'disabled'} in the UI demo.`,
    });
  }

  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION · DEMO CONFIGURATION" title="Roles & permissions" description="Review sample access roles and toggle their demo permission matrix." actions={<button className="button button-primary" onClick={() => { setFormError(''); setModalOpen(true); }}><Plus size={15} /> Create role</button>} />
      <SimulatedBanner>Permission toggles are an interface demonstration only. They do not grant, revoke, or enforce access; authorization must be implemented and verified by a backend.</SimulatedBanner>
      <section className="management-stat-grid">
        <article><span className="management-stat-icon stat-icon-teal"><KeyRound size={17} /></span><div><span>Configured roles</span><strong>{roles.length}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-blue"><ShieldCheck size={17} /></span><div><span>Assigned demo users</span><strong>{assignedUsers}</strong></div></article>
        <article><span className="management-stat-icon stat-icon-amber"><LockKeyhole size={17} /></span><div><span>Protected system roles</span><strong>{roles.filter((role) => role.locked).length}</strong></div></article>
      </section>
      <div className="roles-layout">
        <section className="panel role-list-panel" aria-label="Available roles">
          <div className="panel-heading"><div><h2>Available roles</h2><p>Select a role to review its sample access matrix.</p></div></div>
          <div className="role-list">
            {roles.map((role) => (
              <button className={`role-list-item ${role.id === selectedRole?.id ? 'selected' : ''}`} key={role.id} onClick={() => setSelectedRoleId(role.id)} aria-pressed={role.id === selectedRole?.id}>
                <span className="role-avatar"><KeyRound size={15} /></span>
                <span><strong>{role.name}</strong><small>{role.users} assigned · {role.description}</small></span>
                {role.locked && <LockKeyhole size={14} className="role-locked-icon" aria-label="Protected role" />}
              </button>
            ))}
          </div>
        </section>
        <section className="panel permissions-panel" aria-labelledby="permission-heading">
          <div className="panel-heading"><div><h2 id="permission-heading">{selectedRole?.name ?? 'Role permissions'}</h2><p>{selectedRole?.description}</p></div>{selectedRole?.locked && <span className="role-protected-label"><LockKeyhole size={12} /> Protected</span>}</div>
          <div className="permission-table-scroll">
            <table className="permission-table">
              <thead><tr><th scope="col">Feature area</th><th scope="col">Access</th></tr></thead>
              <tbody>{PERMISSION_GROUPS.map(({ key, label }) => {
                const enabled = Boolean(selectedRole?.permissions[key]);
                return <tr key={key}><th scope="row">{label}</th><td><button className={`permission-toggle ${enabled ? 'enabled' : ''}`} type="button" role="switch" aria-checked={enabled} aria-label={`${label} access ${enabled ? 'enabled' : 'disabled'}${selectedRole?.locked ? ' (protected)' : ''}`} disabled={selectedRole?.locked} onClick={() => togglePermission(key, !enabled)}><span />{enabled ? <Check size={12} /> : <X size={12} />}<span className="permission-toggle-label">{enabled ? 'Enabled' : 'Disabled'}</span></button></td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="permission-footnote"><LockKeyhole size={13} /> Super Admin is locked in this demo to avoid accidental removal of all administrative access.</div>
        </section>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create demo role" description="New roles start with all permission groups disabled.">
        <form className="management-form" onSubmit={submitRole}>
          <div className="form-grid">
            <label className="field-block form-grid-full"><span>Role name</span><input name="name" required minLength="3" maxLength="60" placeholder="e.g. Customer Support" /></label>
            <label className="field-block form-grid-full"><span>Description</span><textarea name="description" rows="3" required minLength="5" maxLength="160" placeholder="Describe the intended scope of this role" /></label>
          </div>
          {formError && <p className="form-feedback" role="alert">{formError}</p>}
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary">Create role</button></div>
        </form>
      </Modal>
    </>
  );
}
