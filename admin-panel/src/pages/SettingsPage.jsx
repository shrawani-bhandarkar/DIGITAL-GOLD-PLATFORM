import { useEffect, useRef, useState } from 'react';
import { Bell, Check, RotateCcw, Save, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { DEFAULT_SETTINGS } from '../data/adminData.js';
import { useAdmin } from '../context/AdminContext.jsx';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { settings, updateSettings, recordAudit } = useAdmin();
  const [draft, setDraft] = useState(settings);
  const [notice, setNotice] = useState('');
  const [confirmAction, setConfirmAction] = useState('');
  const formRef = useRef(null);

  useEffect(() => setDraft(settings), [settings]);

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice('');
  }

  async function saveSettings(event) {
    event.preventDefault();
    if (!draft.organizationName.trim() || !draft.supportEmail.trim()) return;
    const result = await updateSettings({ ...draft, organizationName: draft.organizationName.trim(), supportEmail: draft.supportEmail.trim().toLowerCase() });
    if (!result.success) { setNotice(result.message); return; }
    recordAudit({ action: 'Updated platform settings', category: 'Settings', target: 'Platform preferences', detail: 'Saved local demo settings. No backend configuration changed.' });
    setNotice('Settings saved.');
  }

  async function confirmChange() {
    if (confirmAction === 'maintenance') {
      const maintenanceMode = !draft.maintenanceMode;
      const next = { ...draft, maintenanceMode };
      const result = await updateSettings(next);
      if (!result.success) { setNotice(result.message); setConfirmAction(''); return; }
      setDraft(next);
      recordAudit({ action: `${maintenanceMode ? 'Enabled' : 'Disabled'} maintenance mode`, category: 'Settings', target: 'Maintenance mode', detail: 'Local demo preference changed; no service availability is affected.' });
      setNotice(`Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'}.`);
    } else if (confirmAction === 'reset') {
      const result = await updateSettings(DEFAULT_SETTINGS);
      if (!result.success) { setNotice(result.message); setConfirmAction(''); return; }
      setDraft(DEFAULT_SETTINGS);
      recordAudit({ action: 'Reset platform settings', category: 'Settings', target: 'Platform preferences', detail: 'Restored local demo defaults.' });
      setNotice('Settings restored.');
    }
    setConfirmAction('');
  }

  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION" title="Settings" description="Configure persisted organization, display, and notification preferences." actions={<button className="button button-primary" onClick={() => formRef.current?.requestSubmit()}><Save size={15} /> Save settings</button>} />
      {notice && <div className="operation-notice" role="status"><Check size={14} />{notice}</div>}
      <form ref={formRef} className="settings-form" onSubmit={saveSettings}>
        <section className="panel settings-panel">
          <div className="settings-section-heading"><span className="settings-icon"><SettingsIcon size={17} /></span><div><h2>Organization &amp; display</h2><p>Local console labels and regional display preferences.</p></div></div>
          <div className="settings-grid">
            <label className="field-block"><span>Organization name</span><input value={draft.organizationName} onChange={(event) => updateField('organizationName', event.target.value)} required minLength="2" maxLength="100" /></label>
            <label className="field-block"><span>Support email</span><input type="email" value={draft.supportEmail} onChange={(event) => updateField('supportEmail', event.target.value)} required maxLength="120" /></label>
            <label className="field-block"><span>Timezone</span><select value={draft.timezone} onChange={(event) => updateField('timezone', event.target.value)}><option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option><option value="UTC">Coordinated Universal Time (UTC)</option><option value="Asia/Dubai">Gulf Standard Time (Asia/Dubai)</option></select></label>
            <label className="field-block"><span>Date display</span><select value={draft.dateFormat} onChange={(event) => updateField('dateFormat', event.target.value)}><option>DD MMM YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></label>
            <label className="field-block"><span>Demo session timeout (minutes)</span><input type="number" min="5" max="240" step="5" required value={draft.sessionTimeout} onChange={(event) => updateField('sessionTimeout', Number(event.target.value))} /></label>
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="settings-section-heading"><span className="settings-icon settings-icon-blue"><Bell size={17} /></span><div><h2>Notifications &amp; status</h2><p>These preferences are stored for the admin console.</p></div></div>
          <div className="settings-options">
            <label className="settings-option"><span><strong>Login alerts</strong><small>Show a local preference for administrator login notifications.</small></span><input type="checkbox" checked={draft.loginAlerts} onChange={(event) => updateField('loginAlerts', event.target.checked)} /></label>
            <label className="settings-option"><span><strong>Weekly report reminder</strong><small>Enable a reminder preference. No email is sent by this API.</small></span><input type="checkbox" checked={draft.weeklyReport} onChange={(event) => updateField('weeklyReport', event.target.checked)} /></label>
          </div>
          <div className="maintenance-row"><span className="settings-icon settings-icon-amber"><ShieldAlert size={17} /></span><span><strong>Maintenance mode flag</strong><small>Stored setting only; it does not alter API availability.</small></span><button type="button" className={`button ${draft.maintenanceMode ? 'button-danger' : 'button-secondary'}`} onClick={() => setConfirmAction('maintenance')}>{draft.maintenanceMode ? 'Turn off' : 'Turn on'} flag</button></div>
        </section>
        <div className="settings-footer"><button type="button" className="button button-secondary" onClick={() => setConfirmAction('reset')}><RotateCcw size={14} /> Reset to demo defaults</button><button type="submit" className="button button-primary"><Save size={14} /> Save settings</button></div>
      </form>
      <ConfirmDialog open={Boolean(confirmAction)} title={confirmAction === 'reset' ? 'Reset demo settings?' : `${draft.maintenanceMode ? 'Turn off' : 'Turn on'} demo maintenance banner?`} description={confirmAction === 'reset' ? 'Your local preference values will be reset to the sample defaults.' : 'This only changes a local status preference. It will not affect platform availability.'} confirmLabel={confirmAction === 'reset' ? 'Reset settings' : 'Confirm demo change'} destructive={confirmAction === 'reset'} onCancel={() => setConfirmAction('')} onConfirm={confirmChange} />
    </>
  );
}
