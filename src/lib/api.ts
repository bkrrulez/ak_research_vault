export interface Project {
  id: number;
  name: string;
  query: string;
  settings: any;
  semantic_map?: any;
  created_at: string;
}

export interface LinkItem {
  id: number;
  project_id: number;
  url: string;
  title: string;
  snippet: string;
  source: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  key_value: string;
  service_name: string;
  label: string;
  created_at: string;
}

export interface VaultUser {
  id: string;
  email: string;
  full_name: string;
  role: "Admin" | "User";
  access_start_date: string;
  access_end_date: string;
  created_at: string;
  is_system_admin?: boolean;
}

async function handleResponse(response: Response, context: string) {
  if (response.status === 401) {
    localStorage.removeItem("vault_token");
    localStorage.removeItem("vault_user");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }
  
  if (!response.ok) {
    let errorMsg = `Failed to ${context}`;
    
    try {
      // First try to get the raw text to be safe
      const text = await response.text();
      try {
        const errorData = JSON.parse(text);
        if (errorData.error) {
          if (typeof errorData.error === 'string') {
            errorMsg = errorData.error;
          } else if (typeof errorData.error === 'object') {
            errorMsg = errorData.error.message || errorData.error.details || JSON.stringify(errorData.error);
          }
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch {
        // Not a JSON error, use the raw text if available
        if (text) errorMsg = text;
      }
    } catch {
      // Failed to read body at all
    }
    
    throw new Error(errorMsg);
  }
  
  return response.json();
}

/**
 * Enhanced fetch with a 5-minute timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const timeoutMs = 300000; // 5 minutes
  
  // AbortSignal.timeout is relatively new, fallback for safety
  let signal: AbortSignal;
  if ('timeout' in AbortSignal) {
    signal = (AbortSignal as any).timeout(timeoutMs);
  } else {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    signal = controller.signal;
  }

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || signal
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs/1000}s`);
    }
    throw error;
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem("vault_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetchWithTimeout("/api/projects", { headers: getAuthHeaders() });
  return handleResponse(response, "fetch projects");
}

export async function fetchProject(id: string): Promise<Project> {
  const response = await fetchWithTimeout(`/api/projects/${id}`, { headers: getAuthHeaders() });
  return handleResponse(response, "fetch project");
}

export async function updateProject(id: string, project: Partial<Project>): Promise<Project> {
  const response = await fetchWithTimeout(`/api/projects/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(project),
  });
  return handleResponse(response, "update project");
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response, "delete project");
}

export async function createProject(project: Partial<Project>): Promise<Project> {
  const response = await fetchWithTimeout("/api/projects", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(project),
  });
  return handleResponse(response, "create project");
}

export async function fetchLinks(projectId: string): Promise<LinkItem[]> {
  const response = await fetchWithTimeout(`/api/links?projectId=${projectId}`, { headers: getAuthHeaders() });
  return handleResponse(response, "fetch links");
}

export async function addLink(link: Partial<LinkItem>): Promise<LinkItem> {
  const response = await fetchWithTimeout("/api/links", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(link),
  });
  return handleResponse(response, "add link");
}

export async function deleteLink(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/links/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    await handleResponse(response, "delete link");
  }
}

export async function executeSearch(
  query: string, 
  options: { 
    regions?: string[]; 
    languages?: string[]; 
    sources?: string[]; 
    ranking?: string; 
    resultCount?: number 
  } = {}
): Promise<any[]> {
  const { 
    regions = ["Global"], 
    languages = ["en"], 
    sources = ["Google News", "DuckDuckGo"], 
    ranking = "keyword", 
    resultCount = 999 
  } = options;
  
  const response = await fetchWithTimeout("/api/search", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, resultCount, regions, languages, sources, ranking }),
  });
  return handleResponse(response, "execute search");
}

export async function fetchApiKeys(service?: string): Promise<ApiKey[]> {
  const url = service ? `/api/keys?service=${service}` : "/api/keys";
  const response = await fetchWithTimeout(url, { headers: getAuthHeaders() });
  return handleResponse(response, "fetch keys");
}

export async function createApiKey(key: { key_value: string; label?: string; service_name?: string }): Promise<ApiKey> {
  const response = await fetchWithTimeout("/api/keys", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(key),
  });
  return handleResponse(response, "create key");
}

export async function deleteApiKey(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/keys/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response, "delete key");
}

export async function fetchLlmModels(): Promise<{ models: any[], selectedModel: string | null, hasFallbackKey?: boolean }> {
  const response = await fetchWithTimeout("/api/llm/models", { headers: getAuthHeaders() });
  return handleResponse(response, "fetch LLM models");
}

export async function selectLlmModel(modelId: string): Promise<void> {
  const response = await fetchWithTimeout("/api/llm/select-model", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ modelId }),
  });
  return handleResponse(response, "select LLM model");
}

export async function startFetchNvidiaModels(): Promise<{ count: number }> {
  const response = await fetchWithTimeout("/api/llm/fetch-models", {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse(response, "trigger NVIDIA model fetch");
}

export async function analyzeText(text: string, context?: string): Promise<{ analysis: string }> {
  const response = await fetchWithTimeout("/api/llm/analyze", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ text, context }),
  });
  return handleResponse(response, "analyze text");
}

export async function generateSemanticMap(items: any[], query: string, projectId?: string): Promise<{ nodes: any[], edges: any[] }> {
  const response = await fetchWithTimeout("/api/llm/semantic-map", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ items, query, projectId }),
  });
  return handleResponse(response, "generate semantic map");
}

export async function updateApiKey(id: string, key: { key_value?: string; label?: string }): Promise<ApiKey> {
  const response = await fetchWithTimeout(`/api/keys/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(key),
  });
  return handleResponse(response, "update key");
}

export async function fetchUsers(): Promise<VaultUser[]> {
  const response = await fetchWithTimeout("/api/users", { headers: getAuthHeaders() });
  return handleResponse(response, "fetch users");
}

export async function createVaultUser(user: Partial<VaultUser> & { password?: string }): Promise<VaultUser> {
  const response = await fetchWithTimeout("/api/users", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(user),
  });
  return handleResponse(response, "create user");
}

export async function updateVaultUser(id: string, user: Partial<VaultUser>): Promise<VaultUser> {
  const response = await fetchWithTimeout(`/api/users/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(user),
  });
  return handleResponse(response, "update user");
}

export async function deleteVaultUser(id: string): Promise<void> {
  const response = await fetchWithTimeout(`/api/users/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse(response, "delete user");
}
