import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, User, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const navigate = useNavigate();

  // Auto focus logic
  useEffect(() => {
    // Check if user is already logged in
    if (sessionStorage.getItem('wings_auth') === 'true' || localStorage.getItem('wings_auth') === 'true') {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multiple submits
    if (isLoading) return;

    // normalizing inputs
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 7. Console logging for debugging
    console.log('[Login Debug] Attempting login with:', {
      rawUsername: username,
      cleanUsername,
      passwordLength: password.length,
      password: cleanPassword // Logged as requested for debugging
    });

    if (!cleanUsername || !cleanPassword) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate API delay for better UX and to prevent instant-flicker
      await new Promise(resolve => setTimeout(resolve, 800));

      if (cleanUsername === 'wings' && cleanPassword === 'wingster123') {

        // Success
        toast.success('Login Successful!');

        // Handle Persistence
        sessionStorage.setItem('wings_auth', 'true');
        if (rememberMe) {
          localStorage.setItem('wings_auth', 'true');
        } else {
          localStorage.removeItem('wings_auth');
        }

        navigate('/dashboard');
      } else {
        // Error
        throw new Error('Invalid credentials. Please check your username and password.');
      }
    } catch (error: any) {
      console.error('[Login Error]', error);
      toast.error(error.message || 'Login failed');
      // Clear password field on error for security/UX
      // setPassword(''); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">

        {/* Header Section */}
        <div className="bg-primary p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-900/20 pattern-grid-lg opacity-20"></div>
          <div className="relative z-10">
            <div className="inline-flex p-3 rounded-full bg-white/10 mb-4 backdrop-blur-sm shadow-inner border border-white/20">
              <GraduationCap className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Wings Coaching Center</h2>
            <p className="text-blue-100 mt-2 text-sm font-medium opacity-90">Attendance Management Portal</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-8 space-y-6">

          {/* Username Input */}
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-semibold text-slate-700 ml-1">
              Username
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                <User className="h-5 w-5" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                inputMode="text"
                enterKeyHint="next"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-200 text-slate-800 placeholder:text-slate-400 font-medium"
                placeholder="Enter username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 ml-1">
              Password
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                inputMode="text"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-blue-500/10 outline-none transition-all duration-200 text-slate-800 placeholder:text-slate-400 font-medium"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Options */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary/25 cursor-pointer transition-all"
                />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800 transition-colors">Remember me</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`
              w-full py-3.5 px-4 rounded-xl text-white font-bold text-lg
              shadow-lg shadow-blue-900/20 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
              transition-all duration-200
              flex items-center justify-center gap-2
              ${isLoading ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-blue-700'}
            `}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>

          {/* Helper Text */}
          <div className="text-center">
            <p className="text-xs font-medium text-slate-400 bg-slate-50 py-2 rounded-lg border border-slate-100">
              Default Access: wings / wingster123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;