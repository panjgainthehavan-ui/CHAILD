import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  LockKeyhole, 
  CheckCircle2, 
  AlertCircle,
  Wifi,
  Battery
} from 'lucide-react';
import { io } from 'socket.io-client';
import { CapacitorAndroidKiosk } from '@capgo/capacitor-android-kiosk';

const BackgroundMode = {
  enable: () => window.cordova?.plugins?.backgroundMode?.enable(),
  disable: () => window.cordova?.plugins?.backgroundMode?.disable(),
  setDefaults: (cfg) => window.cordova?.plugins?.backgroundMode?.setDefaults(cfg),
  moveToForeground: () => window.cordova?.plugins?.backgroundMode?.moveToForeground(),
  moveToBackground: () => window.cordova?.plugins?.backgroundMode?.moveToBackground()
};

const BACKEND_URL = import.meta.env?.VITE_BACKEND_HOST || 'https://suraksha-kawach-backend-6puv.onrender.com';
const socket = io(BACKEND_URL, { forceNew: true, multiplex: false });

const ChildView = ({ onLogout }) => {
  const [linkingCode, setLinkingCode] = useState('');
  const [isLinked, setIsLinked] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [deviceLocked, setDeviceLocked] = useState(false);

  useEffect(() => {
    // When linked, activate background mode so the socket stays alive
    try {
      if (isLinked) {
         BackgroundMode.enable();
         BackgroundMode.setDefaults({
             title: 'Suraksha Kawach Active',
             text: 'Protecting this device in the background.',
             hidden: false,
             silent: true
         });
      } else {
         BackgroundMode.disable();
      }
    } catch(e) { console.warn("Background Mode error:", e); }
  }, [isLinked]);

  useEffect(() => {
    const toggleLock = async () => {
       try {
          if (deviceLocked) {
             // 1. Force app to front
             try { BackgroundMode.moveToForeground(); } catch(e){}
             // 2. Lock screen
             await CapacitorAndroidKiosk.enterKioskMode();
          } else {
             await CapacitorAndroidKiosk.exitKioskMode();
             // Unlock background overrides
             try { BackgroundMode.moveToBackground(); } catch(e){}
          }
       } catch(e) { console.warn('Kiosk Error:', e); }
    };
    toggleLock();
  }, [deviceLocked]);

  useEffect(() => {
    const savedCode = localStorage.getItem('suraksha_child_id');
    if (savedCode) {
       setLinkingCode(savedCode);
       setIsLinking(true);
       socket.emit('child-link', savedCode);
    }
    
    socket.on('connect', () => {
       setIsConnected(true);
       const retryCode = localStorage.getItem('suraksha_child_id') || linkingCode.trim();
       if (retryCode) {
          socket.emit('child-link', retryCode);
       }
    });

    socket.on('disconnect', () => {
       setIsConnected(false);
    });

    socket.on('link-success', ({ name, isLocked }) => {
       setIsLinking(false);
       setIsLinked(true);
       setDeviceLocked(isLocked);
    });

    socket.on('link-error', (err) => {
       setIsLinking(false);
       setError(err);
       localStorage.removeItem('suraksha_child_id');
    });

    socket.on(`lock-status-changed:${linkingCode}`, (status) => {
       setDeviceLocked(status);
    });

    return () => {
       socket.off('connect');
       socket.off('link-success');
       socket.off('link-error');
       socket.off(`lock-status-changed:${linkingCode}`);
    };
  }, [linkingCode]);

  const handleLinkDevice = (e) => {
    e.preventDefault();
    const cleanCode = linkingCode.trim();
    const isValidFormat = /^SK-\d{6}$/.test(cleanCode);
    if (!isValidFormat) {
      setError('Galat Code! Kripya sahi ID daliye (Jaise: SK-123456)');
      return;
    }
    setError('');
    setIsLinking(true);
    localStorage.setItem('suraksha_child_id', cleanCode);
    socket.emit('child-link', cleanCode);
  };

  const handleFullLogout = () => {
     localStorage.removeItem('suraksha_child_id');
     onLogout();
  };

  if (deviceLocked) {
     return (
       <div className="flex flex-col h-screen bg-rose-600 font-sans text-white items-center justify-center p-8 z-50 fixed inset-0 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white/20 p-6 rounded-full mb-8 animate-pulse shadow-[0_0_60px_rgba(255,255,255,0.4)]">
             <LockKeyhole size={80} className="text-white" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tight">Device Locked</h1>
          <p className="text-center text-rose-100 font-medium text-lg leading-relaxed">Aapke parent ne phone screen lock kar di hai.<br/><br/>Jab tak woh unlock nahi karte, phone lock rahega.</p>
       </div>
     );
  }

  if (isLinked) {
     return (
       <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 relative z-40 items-center justify-center p-8">
          <div className="bg-emerald-100 p-6 rounded-full mb-8 shadow-inner animate-pulse">
             <CheckCircle2 size={80} className="text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black mb-4 tracking-tight text-slate-800 text-center">Protected</h1>
          <p className="text-center text-slate-600 font-medium text-lg leading-relaxed mb-8">
            Phone is now linked and monitored.<br/>
            You can press the <strong>Home Button</strong> to exit this screen. App will run in the background.
          </p>
          <button onClick={handleFullLogout} className="px-6 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl active:scale-95 transition-all outline-none">
            Unlink Device (Need Parent Permission)
          </button>
       </div>
     );
  }

  // Setup Screen
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-indigo-200/50 rounded-full blur-[80px]"></div>
      <div className="absolute bottom-[-10%] left-[-20%] w-80 h-80 bg-blue-100/60 rounded-full blur-[80px]"></div>

      <div className="flex-1 flex flex-col justify-center px-6 z-10">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex justify-center mb-8 animate-in zoom-in duration-500">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse"></div>
              <div className="bg-white p-5 rounded-3xl shadow-xl shadow-indigo-100/50 border border-white relative z-10">
                <LockKeyhole size={40} className="text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="text-center mb-10 animate-in slide-in-from-bottom-4 duration-500 delay-100">
            <h1 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Child Mode Setup</h1>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Mummy ya Papa ki 'Suraksha Kawach' app mein di gayi ID ko yahan likhiye.
            </p>
          </div>

          <form onSubmit={handleLinkDevice} className="space-y-6 animate-in slide-in-from-bottom-6 duration-500 delay-200">
            <div className="relative">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2 px-2">Linking ID</label>
              <div className="relative flex items-center">
                <Smartphone size={20} className="absolute left-4 text-slate-400 z-10" />
                <input 
                  type="text" 
                  value={linkingCode}
                  onChange={(e) => setLinkingCode(e.target.value.toUpperCase())}
                  placeholder="SK-XXXXXX"
                  className={`w-full bg-white border-2 rounded-2xl py-4 pl-12 pr-4 text-lg font-black tracking-widest placeholder:text-slate-300 placeholder:font-medium transition-all outline-none focus:ring-4 focus:ring-indigo-100 ${
                    error ? 'border-red-300 text-red-600 focus:border-red-500' : 'border-white focus:border-indigo-400 shadow-sm text-indigo-900'
                  }`}
                  disabled={isLinking}
                />
              </div>
              {error && (
                <p className="text-xs text-red-500 font-bold mt-2 px-2 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle size={12} /> {error}
                </p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isLinking || !linkingCode}
              className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl ${
                isLinking 
                ? 'bg-indigo-400 text-white cursor-not-allowed shadow-indigo-200' 
                : linkingCode
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 shadow-none'
              }`}
            >
              {isLinking ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Link ho raha hai...
                </>
              ) : (
                'Jodna Shuru Karein'
              )}
            </button>
          </form>

          <div className="mt-8 text-center animate-in fade-in duration-500 delay-300 flex flex-col items-center gap-4">
            <p className="text-xs font-bold text-slate-400 flex justify-center items-center gap-1">
              <ShieldCheck size={14} /> Suraksha Kawach Platform
            </p>
            <button onClick={onLogout} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 hover:underline">Switch Role (Go Back)</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChildView;
