import React, { useState } from 'react';
import { ShieldAlert, Lock, User, KeyRound, AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { AppUser } from '../types/lottery';
import { sound } from '../utils/audio';
import { lotteryApi } from '../utils/lotteryApi';

interface AdminLoginProps {
  onLogin: (ownerAccount: AppUser, token: string) => void;
  onOpenPlayerPortal?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, onOpenPlayerPortal }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('សូមបញ្ចូលឈ្មោះគណនី Owner និងពាក្យសម្ងាត់!');
      return;
    }

    setIsLoading(true);
    sound.playClick();

    const res = await lotteryApi.ownerLogin(cleanUser, password);
    setIsLoading(false);

    if (!res.ok || !res.data) {
      sound.playBeep();
      if (res.status === 0) {
        setError('មិនអាចភ្ជាប់ទៅកាន់ Backend Server បានទេ! សូមពិនិត្យថា Game Server (127.0.0.1:3000) កំពុងដំណើរការ។');
      } else {
        setError('ឈ្មោះគណនី ឬពាក្យសម្ងាត់ Owner មិនត្រឹមត្រូវទេ!');
      }
      return;
    }

    sound.playWin();
    onLogin(res.data.account, res.data.token);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex flex-col justify-center items-center p-4 selection:bg-amber-500 selection:text-slate-950">
      {/* Decorative luxury back-office background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-300 p-1 shadow-[0_10px_30px_rgba(245,158,11,0.3)] mb-3">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-amber-400" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400">
            ប្រព័ន្ធគ្រប់គ្រង OWNER ADMIN
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-1">
            Back-Office Management Console (ឆ្នោតសំណាង 1/99)
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs mt-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>សម្រាប់តែម្ចាស់ប្រព័ន្ធ (Platform Owner Only) ប៉ុណ្ណោះ</span>
          </div>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>ផ្ទៀងផ្ទាត់សិទ្ធិម្ចាស់ប្រព័ន្ធ (Owner Authorization)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              គ្រប់គ្រងគណនីអ្នកលេង, កាបូបប្រាក់, កំណត់លទ្ធផលឆ្នោត, និងត្រួតពិនិត្យរបាយការណ៍
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/15 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5 text-rose-300 text-xs animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Owner Username */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                ឈ្មោះគណនីម្ចាស់ប្រព័ន្ធ (Owner Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="បញ្ចូលឈ្មោះគណនី Owner"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                ពាក្យសម្ងាត់ (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="បញ្ចូលពាក្យសម្ងាត់ Owner"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-black text-sm tracking-wide text-slate-950 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>ចូលកាន់ផ្ទាំងគ្រប់គ្រង (LOGIN TO BACK-OFFICE)</span>
                </>
              )}
            </button>
          </form>

          {/* Link back to player portal if needed */}
          {onOpenPlayerPortal && (
            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={onOpenPlayerPortal}
                className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition-colors"
              >
                <span>ទៅកាន់ផ្ទាំងអ្នកលេងចាក់ឆ្នោត (Player Platform)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
