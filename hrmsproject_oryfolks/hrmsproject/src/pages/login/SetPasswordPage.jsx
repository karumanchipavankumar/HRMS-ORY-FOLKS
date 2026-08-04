import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LoginBG from "../../assets/Color-blur-abstract-background-vector.jpg";
import Logo from "../../assets/ORYFOLKS-logo.png";
import api from "../../utils/api";

const SetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [tempPassword, setTempPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [validating, setValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [validationError, setValidationError] = useState("");
  
  // Wizard state: 1 = verify temporary password, 2 = set new password
  const [step, setStep] = useState(1);
  const [verifyingTemp, setVerifyingTemp] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  // Eye icon visibility states
  const [showTemp, setShowTemp] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const navigate = useNavigate();

  // Validate token on load
  useEffect(() => {
    if (!token) {
      setIsValidToken(false);
      setValidationError("No password setup token was provided in the link.");
      setValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await api(`/api/password/validate-token?token=${token}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || "Invalid, expired, or already used setup token.");
        }
        const data = await res.json();
        setEmployeeName(data.employeeName);
        setLoginId(data.loginId);
        setIsValidToken(true);
      } catch (err) {
        setIsValidToken(false);
        setValidationError(err.message || "Failed to validate setup token.");
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Password strength checks
  const criteria = {
    length: password.length >= 12,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()\-=_+[\]{}|;:,.<>/?]/.test(password),
  };

  const metCount = Object.values(criteria).filter(Boolean).length;

  const getStrengthLabel = () => {
    if (password.length === 0) return { label: "", color: "bg-gray-200", text: "text-gray-400" };
    if (metCount <= 2) return { label: "Weak", color: "bg-red-500", text: "text-red-500" };
    if (metCount <= 4) return { label: "Medium", color: "bg-amber-500", text: "text-amber-500" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-500" };
  };

  const strength = getStrengthLabel();

  // Step 1 handler: Verify Temporary Password
  const handleVerifyTemp = async (e) => {
    e.preventDefault();
    setError("");

    if (!tempPassword.trim()) {
      setError("Please enter the temporary password from your email.");
      return;
    }

    setVerifyingTemp(true);
    try {
      const res = await api("/api/password/verify-temp", {
        method: "POST",
        body: JSON.stringify({ token, tempPassword })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Incorrect temporary password.");
      }

      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingTemp(false);
    }
  };

  // Step 2 handler: Set new password
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (metCount < 5) {
      setError("Please ensure your password meets all strength requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api("/api/password/set", {
        method: "POST",
        body: JSON.stringify({
          token,
          tempPassword,
          password,
          confirmPassword
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to set password.");
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const EyeIcon = ({ visible }) => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {visible ? (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3.5 3.5 0 114.85 4.85M15 15l6 6M9 9L3 3" />
        </>
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </>
      )}
    </svg>
  );

  const inputClass =
    "w-full p-3 pr-10 rounded-lg border border-brand-blue/20 bg-white/50 focus:bg-white focus:border-brand-yellow focus:ring-2 focus:ring-brand-yellow/20 outline-none transition-all text-brand-blue font-semibold placeholder:text-gray-400 text-sm";
  const labelClass = "text-xs font-bold text-brand-blue/80";

  return (
    <div
      className="flex justify-center items-center min-h-screen bg-cover bg-center bg-no-repeat font-brand relative overflow-hidden"
      style={{ backgroundImage: `url(${LoginBG})` }}
    >
      <div className="absolute inset-0 bg-brand-blue/30 backdrop-blur-[2px]" />

      <div className="w-full max-w-[480px] p-8 md:p-10 bg-white/70 backdrop-blur-xl rounded-[32px] shadow-2xl relative z-10 border border-white/40 ring-1 ring-black/5 mx-4 my-8">
        <div className="flex flex-col items-center mb-6">
          <img src={Logo} alt="ORYFOLKS Logo" className="h-12 mb-2 object-contain" />
          <h2 className="text-xl md:text-2xl font-bold text-brand-blue">Account Setup</h2>
          <p className="text-[13px] text-brand-blue/50 text-center mt-1">
            Activate your HRMS account and set your credentials.
          </p>
        </div>

        {validating ? (
          <div className="flex flex-col items-center py-10 space-y-4">
            <svg className="animate-spin w-8 h-8 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
              <path d="M4 12a8 8 0 018-8" opacity="0.75"></path>
            </svg>
            <p className="text-sm font-bold text-brand-blue/70">Validating your onboarding link...</p>
          </div>
        ) : !isValidToken ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-100 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-red-700">Invalid Link</h3>
              <p className="text-sm font-medium text-gray-600 px-4">
                {validationError || "This invitation link is invalid, expired, or has already been used."}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold p-3 rounded-lg flex items-start gap-2 text-left mx-2 mt-4">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2}></circle>
                <line x1="12" y1="8" x2="12" y2="12" strokeWidth={2}></line>
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth={2}></line>
              </svg>
              <span>Onboarding setup links expire automatically after 24 hours and can only be used once. Please contact your HR Liaison or System Administrator for a new invitation.</span>
            </div>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 bg-brand-blue text-white rounded-lg font-bold hover:bg-brand-blue-hover active:scale-[0.98] transition-all shadow-md mt-6"
            >
              Back to Login
            </button>
          </div>
        ) : success ? (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-sm animate-bounce">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-emerald-700">Password Set Successfully!</h3>
              <p className="text-sm font-semibold text-gray-600">
                Hi <strong>{employeeName}</strong>, your account is now active.
              </p>
              <p className="text-xs text-gray-400">
                Redirecting you to the login page...
              </p>
            </div>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md mt-6"
            >
              Go to Login Page
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 bg-brand-blue/5 rounded-2xl border border-brand-blue/10 flex flex-col space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-blue/60">New Account For</span>
              <span className="text-sm font-bold text-brand-blue">{employeeName}</span>
              <span className="text-xs font-semibold text-brand-blue/70">ID: {loginId}</span>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm font-bold border border-red-100">
                {error}
              </div>
            )}

            {/* STEP 1: Verify Temporary Password */}
            {step === 1 && (
              <form onSubmit={handleVerifyTemp} className="space-y-5">
                <div className="space-y-1">
                  <label className={labelClass}>Temporary Password (From Email) *</label>
                  <div className="relative">
                    <input
                      type={showTemp ? "text" : "password"}
                      placeholder="Enter temporary password"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className={inputClass}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowTemp(!showTemp)}
                      className="absolute right-3 top-3 text-brand-blue/60 hover:text-brand-blue outline-none"
                    >
                      <EyeIcon visible={showTemp} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifyingTemp || !tempPassword.trim()}
                  className="w-full py-3 bg-brand-blue text-white rounded-lg font-bold hover:bg-brand-blue-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2 group mt-6"
                >
                  {verifyingTemp ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                        <path d="M4 12a8 8 0 018-8" opacity="0.75"></path>
                      </svg>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify Temporary Password</span>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Choose New Password */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className={labelClass}>New Password *</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      placeholder="Choose a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-3 text-brand-blue/60 hover:text-brand-blue outline-none"
                    >
                      <EyeIcon visible={showNew} />
                    </button>
                  </div>
                </div>

                {/* Password strength visual meter */}
                {password.length > 0 && (
                  <div className="space-y-2 px-1">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-gray-500">Strength:</span>
                      <span className={strength.text}>{strength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex gap-0.5">
                      <div className={`h-full rounded-l-full transition-all ${metCount >= 1 ? strength.color : 'bg-transparent'}`} style={{ width: '20%' }} />
                      <div className={`h-full transition-all ${metCount >= 2 ? strength.color : 'bg-transparent'}`} style={{ width: '20%' }} />
                      <div className={`h-full transition-all ${metCount >= 3 ? strength.color : 'bg-transparent'}`} style={{ width: '20%' }} />
                      <div className={`h-full transition-all ${metCount >= 4 ? strength.color : 'bg-transparent'}`} style={{ width: '20%' }} />
                      <div className={`h-full rounded-r-full transition-all ${metCount >= 5 ? strength.color : 'bg-transparent'}`} style={{ width: '20%' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px] font-semibold text-gray-500">
                      <span className={`flex items-center gap-1 ${criteria.length ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {criteria.length ? "✓" : "•"} Min 12 Characters
                      </span>
                      <span className={`flex items-center gap-1 ${criteria.hasUpper ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {criteria.hasUpper ? "✓" : "•"} Uppercase (A-Z)
                      </span>
                      <span className={`flex items-center gap-1 ${criteria.hasLower ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {criteria.hasLower ? "✓" : "•"} Lowercase (a-z)
                      </span>
                      <span className={`flex items-center gap-1 ${criteria.hasNumber ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {criteria.hasNumber ? "✓" : "•"} Number (0-9)
                      </span>
                      <span className={`flex items-center gap-1 ${criteria.hasSpecial ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {criteria.hasSpecial ? "✓" : "•"} Special Char
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className={labelClass}>Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-3 text-brand-blue/60 hover:text-brand-blue outline-none"
                    >
                      <EyeIcon visible={showConfirm} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || metCount < 5 || password !== confirmPassword}
                  className="w-full py-3 bg-brand-blue text-white rounded-lg font-bold hover:bg-brand-blue-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2 group mt-6"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                        <path d="M4 12a8 8 0 018-8" opacity="0.75"></path>
                      </svg>
                      <span>Activating Account...</span>
                    </>
                  ) : (
                    <span>Activate Account</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SetPasswordPage;
