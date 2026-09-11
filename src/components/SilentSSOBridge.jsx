import React, { useEffect, useState, useRef } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Sparkles, CheckCircle2, ShieldCheck, RefreshCw, X } from 'lucide-react';

export default function SilentSSOBridge({ currentUser, isDarkMode }) {
  const [ssoState, setSsoState] = useState('idle'); // 'idle' | 'syncing' | 'connected'
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  const iframeRef = useRef(null);

  const initSilentSSO = async () => {
    const existingToken = localStorage.getItem('bit_ps_token');
    if (existingToken) {
      setSsoState('connected');
      return;
    }

    setSsoState('syncing');

    // Method 1: Attempt direct background cookie/API handshake via CapacitorHttp
    try {
      if (Capacitor.isNativePlatform()) {
        const pingRes = await CapacitorHttp.get({
          url: 'https://ps.bitsathy.ac.in/api/ps_v2/activity/attendance/summary',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        if (pingRes.status === 200 && pingRes.data) {
          setSsoState('connected');
          window.dispatchEvent(new CustomEvent('ps-auth-updated', { detail: pingRes.data }));
          return;
        }
      }
    } catch (err) {
      console.warn('Silent native probe:', err);
    }

    setSsoState('idle');
  };

  useEffect(() => {
    if (currentUser?.email) {
      initSilentSSO();
    }

    // Listen for custom trigger to open interactive bridge if needed
    const openBridgeHandler = () => setShowInteractiveModal(true);
    window.addEventListener('open-ps-bridge', openBridgeHandler);

    // Listen for cross-window messages from PS or BitCentral
    const handleMessage = (event) => {
      try {
        if (!event.data) return;
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.token || data?.psToken || data?.jwt) {
          const token = data.token || data.psToken || data.jwt;
          localStorage.setItem('bit_ps_token', token);
          setSsoState('connected');
          setShowInteractiveModal(false);
          window.dispatchEvent(new CustomEvent('ps-auth-updated', { detail: { token } }));
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('open-ps-bridge', openBridgeHandler);
      window.removeEventListener('message', handleMessage);
    };
  }, [currentUser]);

  return (
    <>
      {/* Invisible Background SSO Frame */}
      <div className="hidden pointer-events-none opacity-0 fixed -top-[9999px] -left-[9999px] w-0 h-0 overflow-hidden" aria-hidden="true">
        <iframe
          ref={iframeRef}
          src="https://ps.bitsathy.ac.in/login"
          title="PS Background SSO"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="w-0 h-0 border-0"
        />
      </div>

      {/* Interactive Fallback Modal */}
      {showInteractiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 border shadow-2xl relative ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">PS Portal Live Sync</h3>
                  <p className="text-[11px] text-slate-400">One-tap authentication for live attendance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInteractiveModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950">
              <iframe
                src="https://ps.bitsathy.ac.in/login"
                title="PS Portal Live SSO"
                className="w-full h-full border-0"
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-slate-400">Sign in with your @bitsathy.ac.in account above</span>
              <button
                type="button"
                onClick={() => {
                  setShowInteractiveModal(false);
                  initSilentSSO();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
