import React, { useEffect, useState } from 'react';
import App from '../App';
import { loadCloud, saveCloud, onCloudStatus, cloudStatus, cloudError, hasUnsavedChanges, localPreview, previewSourceDate } from '../lib/cloudStore';
export function CloudWorkspace() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [, update] = useState(0);
  const load = () => { setError(''); loadCloud().then(() => setReady(true)).catch(e => setError(e.message)); };
  useEffect(() => { const off = onCloudStatus(() => update(v => v + 1)); load(); return off; }, []);
  if (!ready) return <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col gap-4 items-center justify-center"><h1 className="text-xl">Property Ledger</h1><p>{error || 'Loading your cloud records…'}</p>{error && <><a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a><button onClick={load}>Retry</button></>}</main>;
  return <>{localPreview && <div className="preview-notice">Local preview · snapshot from {previewSourceDate.slice(0,10) || 'empty workspace'} · changes stay on this computer</div>}<div className="bg-neutral-900 text-neutral-200 px-4 py-3 text-sm flex flex-wrap gap-4 items-center" role="status"><span>{cloudStatus}</span>{cloudError && <button onClick={() => void saveCloud()} className="underline">Retry save</button>}<button className="underline ml-auto" onClick={() => { if (!hasUnsavedChanges() || confirm('You have unsaved changes. Download a backup first. Discard the draft and load the latest cloud records?')) window.location.reload(); }}>Load latest</button>{!localPreview && <a href="/signout-with-chatgpt?return_to=%2F">Sign out</a>}</div><App /></>;
}
