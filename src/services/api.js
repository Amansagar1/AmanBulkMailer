const getApiUrl = () => {
  if (typeof process.env.NEXT_PUBLIC_API_URL !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://127.0.0.1:5000";
};

export const fetchCampaignHistory = async () => {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/history`);
  
  if (!res.ok) {
    throw new Error(`Error fetching history: ${res.statusText}`);
  }
  
  return await res.json();
};

export const uploadCampaignAssets = async (formData) => {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || "Upload failed");
  }
  
  return data;
};

export const buildProcessEventUrl = (filePath, resumePath, templatePath) => {
  const apiUrl = getApiUrl();
  let eventUrl = `${apiUrl}/api/process?filePath=${encodeURIComponent(filePath)}`;
  
  if (resumePath) {
    eventUrl += `&resumePath=${encodeURIComponent(resumePath)}`;
  }
  
  if (templatePath) {
    eventUrl += `&templatePath=${encodeURIComponent(templatePath)}`;
  }
  
  return eventUrl;
};

export const loginUser = async (email, password) => {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
};

export const signupUser = async (email, password, senderEmail, senderPassword, name, company, mobile) => {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, senderEmail, senderPassword, name, company, mobile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  return data;
};

export const fetchMe = async (token) => {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch user");
  return data;
};
