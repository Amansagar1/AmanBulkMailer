"use client";

import { useState, useRef, useEffect } from "react";
import { fetchCampaignHistory, uploadCampaignAssets, buildProcessEventUrl, loginUser, signupUser, fetchMe } from "../services/api";

export default function Home() {
  const [dataFile, setDataFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPassword, setSenderPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authCompany, setAuthCompany] = useState("");
  const [authMobile, setAuthMobile] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [subjectTemplate, setSubjectTemplate] = useState("Application for {role} - Kumar Aman Sagar");
  const [bodyTemplate, setBodyTemplate] = useState(`Dear Hiring Team at {company},

I am writing to express my strong interest in the {role} position. With approximately 3 years of hands-on experience building scalable, cloud-native web applications, I have developed deep expertise in full-stack engineering using React, Next.js, Node.js, and MongoDB.

In my recent roles, I have successfully delivered high-impact technical solutions:
• Scalable Architecture: Architected and deployed microservices-based applications, improving system scalability by 25%.
• AI & IoT Integrations: Integrated AI tools for automated lead management and built IoT telemetry modules to process real-time sensor data.
• Security & Performance: Implemented secure JWT and RBAC mechanisms, and optimized full-stack platforms (achieving ~1.8s load times).
• End-to-End Delivery: Managed complete CI/CD pipelines (Docker, GitHub Actions) to ensure stable production deployments.

I am highly confident that my technical background and problem-solving mindset align perfectly with the engineering goals at {company}. 

I have attached my resume for your review. I would welcome the opportunity to discuss how my skills can bring immediate value to your team.

Thank you for your time and consideration.

Best regards,
Kumar Aman Sagar
kumaramansagar01@gmail.com | +91 8434120273
LinkedIn: https://www.linkedin.com/in/kumaramansagar/
GitHub: https://github.com/Amansagar1`);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("idle"); // idle, uploading, processing, complete, error

  const [activeTab, setActiveTab] = useState("runner"); // runner, history
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const dataInputRef = useRef(null);
  const resumeInputRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchMe(token)
        .then(user => {
          setSenderEmail(user.senderEmail || "");
          setSenderPassword(user.senderPassword || "");
          setIsLoggedIn(true);
        })
        .catch(() => {
          localStorage.removeItem("token");
        })
        .finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchCampaignHistory();
      if (data.campaigns) {
        setHistory(data.campaigns);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
    setLoadingHistory(false);
  };

  const handleDataChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setDataFile(e.target.files[0]);
      resetState();
    }
  };

  const handleResumeChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
      resetState();
    }
  };

  const resetState = () => {
    setStatus("idle");
    setLogs([]);
    setProgress(0);
    setTotal(0);
  };

  const startCampaign = async () => {
    if (!dataFile) return;

    setIsUploading(true);
    setStatus("uploading");

    const formData = new FormData();
    formData.append("file", dataFile);
    if (resumeFile) {
      formData.append("resume", resumeFile);
    }
    formData.append("senderEmail", senderEmail);
    formData.append("senderPassword", senderPassword);
    formData.append("subjectTemplate", subjectTemplate);
    formData.append("bodyTemplate", bodyTemplate);

    try {
      const data = await uploadCampaignAssets(formData);

      setIsUploading(false);
      setStatus("processing");

      const eventUrl = buildProcessEventUrl(data.filePath, data.resumePath, data.templatePath);

      const eventSource = new EventSource(eventUrl);

      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);

          if (update.status === "start") {
            setTotal(update.total);
            setLogs((prev) => [...prev, { type: "info", msg: `Initializing queue for ${update.total} recipients...` }]);
          } else if (update.status === "info") {
            setLogs((prev) => [...prev, { type: "info", msg: update.message }]);
          } else if (update.status === "success") {
            setProgress((p) => p + 1);
            setLogs((prev) => [...prev, { type: "success", msg: update.message }]);
          } else if (update.status === "error") {
            setProgress((p) => p + 1);
            setLogs((prev) => [...prev, { type: "error", msg: update.message }]);
          } else if (update.status === "skipped") {
            setProgress((p) => p + 1);
            setLogs((prev) => [...prev, { type: "warning", msg: update.message }]);
          } else if (update.status === "complete") {
            setStatus("complete");
            setLogs((prev) => [...prev, { type: "success", msg: "Process finished." }]);
            eventSource.close();
          }
        } catch (e) {
          console.error("Failed to parse event", event.data);
        }
      };

      eventSource.onerror = (err) => {
        if (status !== "complete") {
          setLogs((prev) => [...prev, { type: "error", msg: "Connection to server closed." }]);
          setStatus("complete");
        }
        eventSource.close();
      };

    } catch (err) {
      setIsUploading(false);
      setStatus("error");
      setLogs((prev) => [...prev, { type: "error", msg: err.message }]);
    }
  };

  const progressPercentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    
    if (authPassword.length < 6) {
      setAuthError("Platform password must be at least 6 characters.");
      return;
    }
    
    if (authMode === "signup") {
      if (authName.trim().length < 2) {
        setAuthError("Please provide a valid full name.");
        return;
      }
      if (authMobile && !/^\+?\d{10,15}$/.test(authMobile.replace(/[-\s]/g, ''))) {
        setAuthError("Please provide a valid mobile number.");
        return;
      }
      if (senderPassword.length < 8) {
        setAuthError("Sender App Password seems too short to be a valid App Password (usually 16 characters).");
        return;
      }
    }

    setAuthLoading(true);
    try {
      let data;
      if (authMode === "login") {
        data = await loginUser(authEmail, authPassword);
      } else {
        data = await signupUser(authEmail, authPassword, senderEmail, senderPassword, authName, authCompany, authMobile);
      }
      localStorage.setItem("token", data.token);
      
      const user = await fetchMe(data.token);
      setSenderEmail(user.senderEmail || "");
      setSenderPassword(user.senderPassword || "");
      setIsLoggedIn(true);
    } catch (err) {
      setAuthError(err.message);
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthCompany("");
    setAuthMobile("");
    setSenderEmail("");
    setSenderPassword("");
  };

  if (authLoading) {
    return <div className="min-h-screen text-white bg-[#050505] flex items-center justify-center font-mono text-sm">Loading System...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 bg-[#050505] flex items-center justify-center p-6">
        <div className={`w-full ${authMode === 'signup' ? 'max-w-3xl' : 'max-w-md'} bg-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden transition-all duration-500`}>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-bold text-white text-2xl font-mono">A</span>
            </div>
            <div className="text-left">
              <h1 className="font-semibold text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">AmanMail</h1>
              <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">By Kumar Aman Sagar</p>
            </div>
          </div>

          <h2 className="text-lg font-medium mb-1 text-center">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-[#a1a1aa] text-xs mb-6 text-center">{authMode === 'login' ? 'Login to access your campaigns.' : 'Sign up to configure your sender profile.'}</p>
          
          {authError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">{authError}</div>}
          
          <form onSubmit={handleAuth} className="flex flex-col gap-4 relative z-10">
            {authMode === 'login' ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Platform Email</label>
                  <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#555]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Platform Password</label>
                  <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono" />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2 bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Platform Email</label>
                      <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#555]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Platform Password</label>
                      <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono" />
                    </div>
                  </div>
                </div>

                <div className="col-span-1 bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Personal Details</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Full Name</label>
                      <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#555]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Mobile Number</label>
                      <input type="tel" value={authMobile} onChange={e => setAuthMobile(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#555]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Company (Optional)</label>
                      <input type="text" value={authCompany} onChange={e => setAuthCompany(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#555]" />
                    </div>
                  </div>
                </div>

                <div className="col-span-1 bg-white/[0.01] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Sender Configuration</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Sender App Email (e.g. Gmail)</label>
                      <input type="email" required value={senderEmail} onChange={e => setSenderEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Sender App Password</label>
                      <input type="password" required value={senderPassword} onChange={e => setSenderPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50 transition-all font-mono" />
                      <p className="text-[10px] text-[#666] mt-1">Stored securely to auto-fill for future campaigns.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button type="submit" disabled={authLoading} className="w-full py-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/20 mt-2 transition-all duration-300">
              {authMode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </form>
          
          <div className="mt-6 text-center relative z-10">
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(""); }} type="button" className="text-xs text-[#a1a1aa] hover:text-white transition-colors">
              {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white font-sans selection:bg-blue-500/30 bg-[#050505]">
      {/* Sleek Glassmorphic Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/10 px-8 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-bold text-white text-lg font-mono">A</span>
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">AmanMail</h1>
              <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">By Kumar Aman Sagar</p>
            </div>
          </div>
          
          <div className="hidden md:flex bg-white/5 rounded-full p-1 border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setActiveTab("runner")}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "runner" ? "bg-white/10 text-white shadow-sm" : "text-[#a1a1aa] hover:text-white"}`}
            >
              Runner
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${activeTab === "history" ? "bg-white/10 text-white shadow-sm" : "text-[#a1a1aa] hover:text-white"}`}
            >
              History
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-[10px] font-medium text-blue-400 tracking-wider">Aman's Workspace</span>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 rounded-xl text-xs font-semibold text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 hover:text-white transition-all">
              Log Out
            </button>
          </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-12">
        {activeTab === "runner" ? (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left Column: Configuration */}
            <div className="w-full lg:w-[450px] shrink-0 bg-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-semibold tracking-tight mb-1">Configuration</h2>
                <p className="text-[#a1a1aa] text-xs">Set up your outreach parameters.</p>
              </div>

              {/* Sender Credentials */}
              <div className="space-y-4">
                <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Sender Account</label>
                <input 
                  type="email" 
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[#555]"
                />
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={senderPassword}
                    onChange={(e) => setSenderPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                  />
                  <button 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#666] hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* CSV Upload */}
              <div className="space-y-3">
                <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Recipient Data (CSV/XLSX) *</label>
                <div
                  onClick={() => dataInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 cursor-pointer flex flex-col items-center justify-center text-center group transition-all duration-300
                  ${dataFile ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-blue-500/30 bg-white/[0.02]'}`}
                >
                  <input type="file" accept=".csv,.xlsx" className="hidden" ref={dataInputRef} onChange={handleDataChange} />
                  <div className={`p-3 rounded-xl mb-3 transition-colors ${dataFile ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-[#888] group-hover:bg-blue-500/20 group-hover:text-blue-400'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">{dataFile ? dataFile.name : "Drop CSV/XLSX file"}</span>
                </div>
              </div>

              {/* Resume Upload */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-medium text-[#a1a1aa] uppercase tracking-wider">Resume Attachment (PDF)</label>
                  <span className="text-[9px] uppercase tracking-wider text-[#666] font-semibold bg-white/5 px-2 py-0.5 rounded">Optional</span>
                </div>
                <div
                  onClick={() => resumeInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 cursor-pointer flex flex-col items-center justify-center text-center group transition-all duration-300
                  ${resumeFile ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 hover:border-indigo-500/30 bg-white/[0.02]'}`}
                >
                  <input type="file" accept=".pdf" className="hidden" ref={resumeInputRef} onChange={handleResumeChange} />
                  <div className={`p-3 rounded-xl mb-3 transition-colors ${resumeFile ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-[#888] group-hover:bg-indigo-500/20 group-hover:text-indigo-400'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">{resumeFile ? resumeFile.name : "Drop PDF Resume"}</span>
                </div>
                <p className="text-[11px] text-[#666]">Falls back to <code className="text-[#888]">amansagar.pdf</code> if skipped.</p>
              </div>

              <button
                disabled={!dataFile || status === 'uploading' || status === 'processing'}
                onClick={startCampaign}
                className={`w-full py-4 rounded-xl text-sm font-semibold transition-all duration-300 ${!dataFile || status === 'uploading' || status === 'processing' ? 'bg-white/5 text-[#666]' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/20'}`}
              >
                {status === 'idle' ? 'Launch Campaign' : status === 'complete' ? 'Finished' : status === 'error' ? 'Retry Campaign' : 'Processing...'}
              </button>
            </div>

            {/* Right Column: Console & Progress */}
            <div className="flex-1 w-full flex flex-col space-y-6 min-w-0">
              
              {/* Email Template Configuration */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl space-y-5">
                <div>
                  <h3 className="text-xl font-semibold text-white tracking-tight">Email Template</h3>
                  <p className="text-xs text-[#a1a1aa] mt-1">Use <span className="text-blue-400 font-mono bg-blue-500/10 px-1 py-0.5 rounded">{"{company}"}</span> and <span className="text-indigo-400 font-mono bg-indigo-500/10 px-1 py-0.5 rounded">{"{role}"}</span> for dynamic insertion.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">Subject Line</label>
                  <input 
                    type="text" 
                    value={subjectTemplate}
                    onChange={(e) => setSubjectTemplate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/60 transition-all placeholder:text-[#555]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#a1a1aa]">Email Body</label>
                  <textarea 
                    value={bodyTemplate}
                    onChange={(e) => setBodyTemplate(e.target.value)}
                    rows={8}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-[13px] text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:bg-black/60 transition-all font-mono leading-relaxed resize-y shadow-inner"
                  ></textarea>
                </div>
              </div>

              {/* Terminal */}
              <div className="bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col flex-1 min-h-[300px]">
                {/* Terminal Header */}
                <div className="bg-[#111] border-b border-white/5 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                  </div>
                  <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest">Live Output</div>
                </div>

                {/* Terminal Body */}
                <div className="p-5 flex-1 overflow-y-auto font-mono text-[13px] leading-relaxed">
                  {logs.length === 0 ? (
                    <div className="text-[#444] h-full flex items-center justify-center">
                      Waiting for campaign deployment...
                    </div>
                  ) : (
                    <div className="space-y-2 pb-4">
                      {logs.map((log, i) => (
                        <div key={i} className={`flex items-start break-words ${log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-emerald-400' :
                              log.type === 'warning' ? 'text-amber-400' : 'text-blue-300'
                          }`}>
                          <span className="opacity-40 mr-3 shrink-0">
                            {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <span className="flex-1">{log.msg}</span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </div>

                {/* Progress Footer */}
                {(status === 'processing' || status === 'complete' || progress > 0) && (
                  <div className="border-t border-white/5 bg-[#111] p-5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[11px] font-mono text-[#888] uppercase tracking-widest">Deployment Progress</span>
                      <span className="text-[11px] font-mono text-white">{progressPercentage}% ({progress}/{total})</span>
                    </div>
                    <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 backdrop-blur-3xl shadow-2xl">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight mb-2 text-white">Campaign History</h2>
                <p className="text-[#a1a1aa] text-sm mb-8">Review your previous outreach campaigns stored in MongoDB.</p>
              </div>

              {loadingHistory ? (
                <div className="text-center py-20 text-[#666] font-mono text-sm">Fetching from MongoDB...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-20 text-[#666] font-mono text-sm border border-dashed border-white/10 rounded-2xl bg-black/20">
                  No campaigns logged yet.
                </div>
              ) : (
                <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#111] border-b border-white/10 text-[#a1a1aa]">
                      <tr>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium">Dataset</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium text-right">Success</th>
                        <th className="px-6 py-4 font-medium text-right">Skipped/Failed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {history.map((campaign) => (
                        <tr key={campaign._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-mono text-[11px] text-[#888]">
                            {new Date(campaign.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-md font-mono text-xs text-blue-300">
                              {campaign.file_name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${campaign.status === 'Completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                campaign.status === 'Failed' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                  'bg-blue-500/10 border-blue-500/20 text-blue-400'
                              }`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-emerald-400 font-mono text-xs">
                            {campaign.success_count}
                          </td>
                          <td className="px-6 py-4 text-right text-amber-400 font-mono text-xs">
                            {campaign.failed_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
