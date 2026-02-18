import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { LocaleCode, SiteContent } from '../types';
import { supabase as supabaseClient } from '../lib/supabaseClient';
import { saveSiteContent } from '../lib/contentService';
import { Dashboard } from '../components/Dashboard';

const initialFormState = { email: '', password: '' };

type AdminPageProps = {
  content: SiteContent;
  onSaveContent: (next: SiteContent) => Promise<void>;
  onForceSync: () => Promise<void>;
  activeLocale: LocaleCode;
  onChangeLocale: (locale: LocaleCode) => void;
};

export function AdminPage({
  content,
  onSaveContent,
  onForceSync,
  activeLocale,
  onChangeLocale,
}: AdminPageProps) {
  const client = supabaseClient;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialFormState);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Checking session…');

  useEffect(() => {
    let ignore = false;

    const syncSession = async () => {
      if (!client) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await client.auth.getSession();
        if (!ignore) {
          setSession(data.session);
        }
      } catch (error) {
        console.error('Failed to fetch session', error);
        if (!ignore) {
          setErrorMessage('Unable to verify session. Please try again.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    syncSession();

    if (!client) {
      return () => {
        ignore = true;
      };
    }

    const { data: listener } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      ignore = true;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setLoadingMessage('Signing in…');
    setLoading(true);

    if (!client) {
      setErrorMessage('Supabase is not configured.');
      setLoading(false);
      return;
    }

    const { error } = await client.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setForm(initialFormState);
    setLoading(false);
  };

  const handleSignOut = async () => {
    if (!client) {
      return;
    }
    await client.auth.signOut();
  };

  const handleSave = async (next: SiteContent) => {
    if (!client) {
      throw new Error('Supabase is not configured');
    }
    await saveSiteContent(next);
    await onSaveContent(next);
  };

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-xl bg-white border border-gray-200 shadow-sm p-6 space-y-3">
          <h1 className="text-lg font-semibold text-gray-900">Admin Unavailable</h1>
          <p className="text-sm text-gray-700">
            Supabase is not configured in this build.
          </p>
          <p className="text-xs text-gray-600">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in GitHub Actions secrets,
            then redeploy.
          </p>
        </div>
      </div>
    );
  }

  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        <p className="text-sm">{loadingMessage}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Program Dashboard Sign In</h1>
            <p className="text-xs text-gray-500 mt-1">
              Enter your Supabase credentials to manage site content.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleSignIn}>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      content={content}
      onSave={handleSave}
      onForceSync={onForceSync}
      activeLocale={activeLocale}
      onChangeLocale={onChangeLocale}
      onSignOut={handleSignOut}
    />
  );
}
