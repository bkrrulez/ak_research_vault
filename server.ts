import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import * as cheerio from "cheerio";
import Parser from "rss-parser";
import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 10;
const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "fallback_secret_key_32_chars_long!!"; // Must be 32 bytes
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  if (!text || typeof text !== "string" || !text.includes(":")) return text;
  try {
    const textParts = text.split(":");
    if (textParts.length < 2) return text;
    
    const ivHex = textParts[0];
    const encryptedHex = textParts.slice(1).join(":");
    
    // IV must be exactly 32 hex chars (16 bytes) for AES-256-CBC
    if (ivHex.length !== 32) return text; 
    
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    // If it looks like encrypted but fails (e.g. wrong key), return text
    return text;
  }
}

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();
const PORT = 3000;
const rssParser = new Parser();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is missing.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Request Logger for debugging
app.use((req, res, next) => {
  if (req.url.startsWith("/api/")) {
    console.log(`[API REQUEST] ${req.method} ${req.url}`);
  }
  next();
});

// Simple Auth Middleware
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const token = authHeader.split(" ")[1];
  try {
    // For this prototype, we'll use a simple base64 "session" token that stores email/role
    const decoded = Buffer.from(token, 'base64').toString();
    const [email, role, exp] = decoded.split(':');
    
    if (new Date(exp) < new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }
    
    (req as any).user = { email, role };
    console.log(`[AUTH] Authenticated user: ${email} (${role})`);
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as any).user?.role !== "Admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
};

// --- API ROUTES ---
const apiRouter = express.Router();

// Individual API route loggers
apiRouter.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  // Explicitly ensure we return JSON for API errors if they fall through
  const originalSend = res.send;
  res.send = function(body) {
    if (res.get('Content-Type')?.includes('text/html')) {
      console.warn(`[WARNING] API route ${req.path} attempted to send HTML! Forcing JSON error.`);
      res.setHeader('Content-Type', 'application/json');
      return originalSend.call(this, JSON.stringify({ error: "Internal Server Error: Unexpected HTML response", path: req.path }));
    }
    return originalSend.call(this, body);
  };
  next();
});

// AUTH
apiRouter.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`[AUTH] Login attempt for: ${email}`);
    
    // Default Admin Check
    const defaultAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const defaultAdminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    
    let user;
    if (defaultAdminEmail && defaultAdminPass && email === defaultAdminEmail && password === defaultAdminPass) {
      console.log(`[AUTH] Default admin login detected`);
      user = {
        email: defaultAdminEmail,
        full_name: "Admin Account",
        role: "Admin",
        access_start_date: "2023-01-01",
        access_end_date: "2099-12-31"
      };
    } else {
      console.log(`[AUTH] Checking database for user: ${email}`);
      // Check Supabase vault_users table
      const { data, error } = await supabase
        .from("vault_users")
        .select("*")
        .eq("email", email)
        .single();
        
      if (error || !data) {
        console.warn(`[AUTH] Login failed for ${email}: ${error?.message || "User not found"}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check password hash or plain text fallback
      let isMatch = false;
      const dbPassword = data.password || "";
      
      // If it looks like a bcrypt hash, compare it
      if (dbPassword.startsWith("$2b$") || dbPassword.startsWith("$2a$")) {
        isMatch = await bcrypt.compare(password, dbPassword);
      } else {
        // Fallback for plain text passwords (legacy users)
        isMatch = password === dbPassword;
        
        // Lazy Migration: If plain text matches, upgrade it to a hash now
        if (isMatch) {
          console.log(`[AUTH] Migrating legacy user ${email} to hashed password...`);
          const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
          await supabase
            .from("vault_users")
            .update({ password: hashedPassword })
            .eq("id", data.id);
        }
      }

      if (!isMatch) {
        console.warn(`[AUTH] Login failed for ${email}: Password mismatch`);
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      console.log(`[AUTH] User found in database: ${data.full_name}`);
      user = data;
    }

    // Check access dates with a 24-hour grace period for the start date
    const now = new Date();
    const start = new Date(user.access_start_date);
    const end = new Date(user.access_end_date);
    
    // Add a 24-hour buffer for start date to account for timezone/creation time issues
    const startWithBuffer = new Date(start.getTime() - (24 * 60 * 60 * 1000));
    
    if (now < startWithBuffer || now > end) {
      console.warn(`[AUTH] Access denied for ${email}: Date range mismatch (Start: ${user.access_start_date}, End: ${user.access_end_date})`);
      return res.status(403).json({ error: "Your access has expired or not started yet. Please contact an administrator." });
    }

    // Generate a mock token (email:role:expiry)
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    const token = Buffer.from(`${user.email}:${user.role}:${expiry.toISOString()}`).toString('base64');
    
    console.log(`[AUTH] Login successful for: ${email}`);
    res.json({
      token,
      user: {
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error(`[AUTH] Exception in login route:`, error);
    res.status(500).json({ error: "Internal server error during authentication", details: error.message });
  }
});

// USERS
apiRouter.get("/users", authenticate, isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from("vault_users").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    
    const defaultAdmin = {
      id: "admin-default",
      email: process.env.NEXT_PUBLIC_ADMIN_EMAIL || "SystemAdmin",
      full_name: "System Admin",
      role: "Admin",
      access_start_date: "2023-01-01",
      access_end_date: "2099-12-31",
      is_system_admin: true
    };
    
    res.json([defaultAdmin, ...(data || [])]);
  } catch (error) {
    handleApiError(res, error, "getUsers");
  }
});

apiRouter.post("/users", authenticate, isAdmin, async (req, res) => {
  try {
    const { email, full_name, role, access_start_date, access_end_date, password } = req.body;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const { data, error } = await supabase.from("vault_users").insert([{
      email, full_name, role, access_start_date, access_end_date, 
      password: hashedPassword,
      created_at: new Date().toISOString()
    }]).select().single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    handleApiError(res, error, "createUser");
  }
});

apiRouter.put("/users/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Hash password if updating
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
    }
    
    const { data, error } = await supabase.from("vault_users").update(updates).eq("id", id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    handleApiError(res, error, "updateUser");
  }
});

apiRouter.delete("/users/:id", authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("vault_users").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "deleteUser");
  }
});

// HEALTH
apiRouter.get("/health", async (req, res) => {
  try {
    const { data, error } = await supabase.from("projects").select("id").limit(1);
    const { data: keysCount, error: keysError } = await supabase.from("api_keys").select("id", { count: 'exact' }).limit(1);
    
    res.json({
      status: "ok",
      supabase: error ? "error" : "connected",
      supabaseError: error,
      keysTable: keysError ? "error" : "connected",
      keysCount: keysCount ? keysCount.length : 0,
      config: {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
        hasTavilyEnv: !!process.env.TAVILY_API_KEY
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// KEYS
apiRouter.get("/keys", authenticate, async (req: any, res) => {
  try {
    const { service } = req.query;
    let query = supabase
      .from("api_keys")
      .select("*")
      .eq("user_email", req.user.email);
    
    if (service) {
      query = query.eq("service_name", service);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    
    // Decrypt keys for the response
    const decryptedData = data.map(item => ({
      ...item,
      key_value: decrypt(item.key_value)
    }));
    
    res.json(decryptedData);
  } catch (error) {
    handleApiError(res, error, "fetching keys");
  }
});

// LLM MODELS
apiRouter.get("/llm/models", authenticate, async (req: any, res) => {
  try {
    const normalizedEmail = req.user.email.toLowerCase();
    
    const { data, error } = await supabase
      .from("llm_models")
      .select("*")
      .eq("user_email", normalizedEmail)
      .order("model_id", { ascending: true });
    
    if (error) throw error;

    // Get the user's selected model
    const { data: userData, error: userError } = await supabase
      .from("vault_users")
      .select("selected_llm_model")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    if (userError) {
      console.error("[LLM] Error fetching user profile:", userError);
    }
    
    const hasNvidiaFallback = !!process.env.NVIDIA_API_KEY;
    console.log(`[LLM] Fetched models for ${req.user.email}. Selected: ${userData?.selected_llm_model}. Fallback: ${hasNvidiaFallback}`);

    res.json({ 
      models: data, 
      selectedModel: userData?.selected_llm_model || null,
      hasFallbackKey: hasNvidiaFallback
    });
  } catch (error) {
    handleApiError(res, error, "fetching LLM models");
  }
});

apiRouter.post("/llm/select-model", authenticate, async (req: any, res) => {
  try {
    const { modelId } = req.body;
    
    // Normalize email
    const normalizedEmail = req.user.email.toLowerCase();

    // Check if user profile exists first to decide between update and insert
    // This is safer than upsert if unique constraints are missing
    const { data: existingUser, error: checkError } = await supabase
      .from("vault_users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (checkError) {
      console.error("[LLM] Error checking user profile:", checkError);
      throw checkError;
    }

    if (existingUser) {
      console.log(`[LLM] Updating existing profile for ${normalizedEmail} with model ${modelId}`);
      const { error: updateError } = await supabase
        .from("vault_users")
        .update({ selected_llm_model: modelId })
        .eq("email", normalizedEmail);
      
      if (updateError) {
        console.error("[LLM] Update failed:", updateError);
        throw updateError;
      }
    } else {
      console.log(`[LLM] Creating new profile for ${normalizedEmail} with model ${modelId}`);
      
      // Satisfy NOT NULL constraint for password if it still exists
      // We use a dummy hashed password since these are managed accounts
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), SALT_ROUNDS);
      
      const { error: insertError } = await supabase
        .from("vault_users")
        .insert({ 
          email: normalizedEmail,
          selected_llm_model: modelId,
          full_name: normalizedEmail.split('@')[0],
          role: req.user.role || "User",
          password: dummyPassword,
          access_start_date: new Date().toISOString().split('T')[0],
          access_end_date: "2099-12-31",
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error("[LLM] Insert failed:", insertError);
        throw insertError;
      }
    }
    
    console.log(`[LLM] Model selection persisted successfully for ${normalizedEmail}: ${modelId}`);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "selecting LLM model");
  }
});

apiRouter.post("/llm/fetch-models", authenticate, async (req: any, res) => {
  try {
    const nvidiaKey = await getEffectiveApiKey(req.user.email, "nvidia", "NVIDIA_API_KEY");
    if (!nvidiaKey) {
      return res.status(401).json({ error: "NVIDIA API Key not found in vault or environment." });
    }

    const baseUrl = "https://integrate.api.nvidia.com/v1";
    const headers = {
      "Authorization": `Bearer ${nvidiaKey}`,
      "Content-Type": "application/json"
    };

    // 1. Fetch models
    const modelsResp = await axios.get(`${baseUrl}/models`, { headers });
    const models = modelsResp.data.data || [];
    
    const results = [];
    
    // 2. Test models (limit to first 999 models as requested)
    const testLimit = 999;
    const modelsToTest = models.slice(0, testLimit);
    const normalizedEmail = req.user.email.toLowerCase();
    
    console.log(`[LLM] Starting test of ${modelsToTest.length} models for ${normalizedEmail}...`);

    // Helper to test a single model
    const testModel = async (m: any) => {
      const modelId = m.id;
      let nonStreamWorks = false;
      let streamWorks = false;

      // Test non-stream
      try {
        const nsResp = await axios.post(`${baseUrl}/chat/completions`, {
          model: modelId,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5
        }, { headers, timeout: 3500 });
        if (nsResp.status === 200 && nsResp.data.choices?.[0]?.message?.content) {
          nonStreamWorks = true;
        }
      } catch (e) {
        // Silent fail for individual model tests
      }

      // Test stream
      try {
        const sResp = await axios.post(`${baseUrl}/chat/completions`, {
          model: modelId,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
          stream: true
        }, { 
          headers: { ...headers, "Accept": "text/event-stream" }, 
          timeout: 4500,
          responseType: 'stream'
        });
        if (sResp.status === 200) streamWorks = true;
      } catch (e) {
        // Silent fail
      }

      if (nonStreamWorks || streamWorks) {
        return {
          user_email: normalizedEmail,
          model_id: modelId,
          non_stream_works: nonStreamWorks,
          stream_works: streamWorks,
          updated_at: new Date().toISOString()
        };
      }
      return null;
    };

    // Test in batches to avoid overwhelming and request timeouts
    // Increasing concurrency to speed up testing 999 models
    const concurrency = 30;
    for (let i = 0; i < modelsToTest.length; i += concurrency) {
      const batch = modelsToTest.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(m => testModel(m)));
      const workingModels = batchResults.filter(r => r !== null);
      results.push(...workingModels);
      
      console.log(`[LLM] Tested batch ${Math.floor(i/concurrency) + 1}: Found ${workingModels.length} working models. Total so far: ${results.length}`);
      
      // Stop early if we have enough and time is running out (rudimentary protection)
      if (results.length >= 100 && i > 300) {
        console.log("[LLM] High volume of working models found, stopping early to avoid timeout.");
        break;
      }
    }

    // 3. Save working models to DB using UPSERT to prevent unique constraint errors
    if (results.length > 0) {
      // Deduplicate in memory first
      const uniqueResults = Array.from(new Map(results.map(item => [item.model_id, item])).values());
      
      const { error: upsertError } = await supabase
        .from("llm_models")
        .upsert(uniqueResults, { onConflict: 'user_email,model_id' });
        
      if (upsertError) {
        console.error("[LLM] Failed to upsert models:", upsertError);
        throw upsertError;
      }
    }

    res.json({ success: true, count: results.length });
  } catch (error) {
    handleApiError(res, error, "fetching/testing LLM models");
  }
});

apiRouter.post("/llm/analyze", authenticate, async (req: any, res) => {
  try {
    const { text, context } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required for analysis." });

    const { apiKey, modelId } = await getLlmConfig(req.user.email);
    
    if (!apiKey) {
      return res.status(401).json({ error: "NVIDIA API Key not configured." });
    }

    if (!modelId) {
      return res.status(400).json({ error: "No LLM model selected. Please select one in LLM Management." });
    }

    const baseUrl = "https://integrate.api.nvidia.com/v1";
    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: modelId,
      messages: [
        { 
          role: "system", 
          content: "You are a specialized Intelligence Analyst. Provide a concise, high-density summary of the following search result. Focus on unique identifiers, dates, and actionable relationships." 
        },
        { 
          role: "user", 
          content: `Context: ${context || 'General'}\n\nSearch Result Content:\n${text}` 
        }
      ],
      max_tokens: 250,
      temperature: 0.2
    }, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 60000
    });

    const analysis = response.data.choices?.[0]?.message?.content;
    res.json({ analysis });
  } catch (error) {
    handleApiError(res, error, "LLM analysis");
  }
});

  apiRouter.post("/llm/semantic-map", authenticate, async (req: any, res) => {
  try {
    const { items, query, projectId } = req.body;
    console.log(`[LLM] Generating semantic map for project ${projectId}. Items: ${items?.length}. Query: "${query}"`);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided for analysis." });
    }

    const { apiKey, modelId } = await getLlmConfig(req.user.email);
    console.log(`[LLM] Config resolved. Model: ${modelId}. Has Key: ${!!apiKey}`);

    if (!apiKey || !modelId) {
      return res.status(400).json({ error: "LLM not configured correctly. Please set NVIDIA API key and select a model in LLM Management." });
    }

    const textToAnalyze = items.map(item => `Title: ${item.title}\nContent: ${item.snippet}`).join("\n\n---\n\n");
    console.log(`[LLM] Text prepared. Length: ${textToAnalyze.length} chars. Calling NVIDIA API...`);
    
    const baseUrl = "https://integrate.api.nvidia.com/v1";
    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: modelId,
      messages: [
        { 
          role: "system", 
          content: `Return ONLY valid JSON.

STRICT RULES:
- No markdown
- No backticks
- No explanations
- No text before or after JSON
- Must start with { and end with }
- Use double quotes only
- No trailing commas

If invalid → return:
{"nodes":[],"edges":[]}`
        },
        { 
          role: "user", 
          content: `Generate a semantic map for the query "${query}" based on these news items:\n\n${textToAnalyze}`
        }
      ],
      temperature: 0.1
    }, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 300000 // 5 minutes
    });

    console.log(`[LLM] Response received. Model: ${modelId}. Parsing...`);

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      console.error("[LLM] Empty choices in response:", response.data);
      return res.status(500).json({ error: "LLM failed to return a response choice." });
    }

    const semanticDataRaw = response.data.choices?.[0]?.message?.content || response.data.choices?.[0]?.text;
    let semanticData: any = null;

    function tryParse(jsonStr: string): boolean {
      // Sequential fixes
      const fixes = [
        (s: string) => s, // As is
        (s: string) => s.replace(/,\s*([}\]])/g, '$1'), // Remove trailing commas
        (s: string) => s.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1'), // Remove comments
        (s: string) => s.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3'), // Quote keys
        (s: string) => {
          // Fix truncated JSON by adding closing braces
          let openBraces = (s.match(/\{/g) || []).length;
          let closeBraces = (s.match(/\}/g) || []).length;
          let openBrackets = (s.match(/\[/g) || []).length;
          let closeBrackets = (s.match(/\]/g) || []).length;
          
          let repaired = s;
          while (closeBrackets < openBrackets) { repaired += ']'; closeBrackets++; }
          while (closeBraces < openBraces) { repaired += '}'; closeBraces++; }
          return repaired;
        }
      ];

      for (const fix of fixes) {
        try {
          const repaired = fix(jsonStr);
          const parsed = JSON.parse(repaired);
          if (parsed && typeof parsed === 'object') {
            // Basic heuristic: check if it looks like what we wanted or at least has content
            if (Array.isArray(parsed.nodes) || Array.isArray(parsed.edges) || (parsed.nodes && typeof parsed.nodes === 'object')) {
              semanticData = parsed;
              console.log(`[LLM] Parse successful with automated repair (fix ${fixes.indexOf(fix)}).`);
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    }
    
    if (typeof semanticDataRaw === 'string' && semanticDataRaw.length > 0) {
      let cleaned = semanticDataRaw.trim();
      
      // REMOVE MARKDOWN FENCES (robust)
      cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      // EXTRA SAFETY: remove ANY stray backticks
      cleaned = cleaned.replace(/`/g, "");

      // Extract JSON if wrapped with text
      const b1 = cleaned.indexOf("{");
      const b2 = cleaned.lastIndexOf("}");

      if (b1 !== -1 && b2 !== -1 && b2 > b1) {
        cleaned = cleaned.substring(b1, b2 + 1);
      }

      console.log(`[LLM] Cleaned Response Snippet: ${cleaned.slice(0, 250)}...`);
      
      try {
        semanticData = JSON.parse(cleaned);
      } catch (e: any) {
        console.log(`[LLM] Standard parse failed. Attempting repair...`);
        if (!tryParse(cleaned)) {
           console.error("[LLM] ALL PARSE ATTEMPTS FAILED:", cleaned);
        }
      }
    } else if (typeof semanticDataRaw === 'object' && semanticDataRaw !== null) {
      semanticData = semanticDataRaw;
    }

    // Validation and Normalization
    if (!semanticData || typeof semanticData !== 'object') {
      console.error("[LLM] Failed to extract any valid JSON object from:", semanticDataRaw);
      return res.status(500).json({ 
        error: "Model failed to return a valid semantic structure.",
        raw: typeof semanticDataRaw === 'string' ? semanticDataRaw.slice(0, 500) : "Invalid format"
      });
    }

    // Try to find nodes/edges if nested
    if (!Array.isArray(semanticData.nodes) && semanticData.analysis && Array.isArray(semanticData.analysis.nodes)) {
       semanticData = semanticData.analysis;
    } else if (!Array.isArray(semanticData.nodes) && semanticData.data && Array.isArray(semanticData.data.nodes)) {
       semanticData = semanticData.data;
    }

    semanticData.nodes = Array.isArray(semanticData.nodes) ? semanticData.nodes : [];
    semanticData.edges = Array.isArray(semanticData.edges) ? semanticData.edges : [];
    
    // Post-process to ensure IDs match and labels exist
    const seenIds = new Set<string>();
    const uniqueNodes: any[] = [];
    
    semanticData.nodes.forEach((n: any) => {
      if (!n) return;
      const id = String(n.id || n.label || '').trim();
      if (!id || seenIds.has(id)) return;
      
      seenIds.add(id);
      uniqueNodes.push({
        id,
        label: String(n.label || id || 'Entity'),
        type: String(n.type || 'Entity')
      });
    });
    
    semanticData.nodes = uniqueNodes;

    semanticData.edges = semanticData.edges
      .map((e: any) => ({
        source: String(e.source || '').trim(),
        target: String(e.target || '').trim(),
        relation: String(e.relation || 'LINKED_TO')
      }))
      .filter((e: any) => 
        e.source && e.target && seenIds.has(e.source) && seenIds.has(e.target)
      );

    console.log(`[LLM] Successfully extracted ${semanticData.nodes.length} nodes and ${semanticData.edges.length} edges.`);

    // Bonus: Fallback safety
    if (!semanticData.nodes || !semanticData.edges || semanticData.nodes.length === 0) {
       return res.json({ nodes: [], edges: [] });
    }

    // Save to project if projectId is provided
    if (projectId) {
      try {
        const { error: updateError } = await supabase
          .from("projects")
          .update({ semantic_map: semanticData })
          .eq("id", projectId)
          .eq("user_email", req.user.email);
        
        if (updateError) {
          console.error("[LLM] Failed to save semantic map to project:", updateError);
        } else {
          console.log(`[LLM] Semantic map persisted for project ${projectId}`);
        }
      } catch (persE) {
        console.error("[LLM] Persist error:", persE);
      }
    }

    res.json(semanticData);
  } catch (error) {
    handleApiError(res, error, "semantic map generation");
  }
});

apiRouter.post("/keys", authenticate, async (req: any, res) => {
  try {
    const { key_value, label, service_name = "tavily" } = req.body;
    if (!key_value) return res.status(400).json({ error: "Key value is required" });
    
    // Encrypt key
    const encryptedKey = encrypt(key_value);
    
    const { data, error } = await supabase
      .from("api_keys")
      .insert([{ 
        key_value: encryptedKey, 
        label: label || `${service_name} Key`, 
        service_name, 
        user_email: req.user.email 
      }])
      .select()
      .single();
    if (error) throw error;
    res.json({ ...data, key_value }); // Return raw key in response for immediate UI update
  } catch (error) {
    handleApiError(res, error, "adding key");
  }
});

apiRouter.delete("/keys/:id", authenticate, async (req: any, res) => {
  try {
    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", req.params.id)
      .eq("user_email", req.user.email);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "deleting key");
  }
});

apiRouter.put("/keys/:id", authenticate, async (req: any, res) => {
  try {
    const { key_value, label } = req.body;
    const updateData: any = {};
    if (key_value) updateData.key_value = key_value;
    if (label) updateData.label = label;

    const { data, error } = await supabase
      .from("api_keys")
      .update(updateData)
      .eq("id", req.params.id)
      .eq("user_email", req.user.email)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    handleApiError(res, error, "updating key");
  }
});

// SEARCH
apiRouter.post("/search", authenticate, async (req, res) => {
  try {
    const { 
      query, 
      resultCount = 20, 
      regions = ["Global"], 
      languages = ["en"], 
      sources = ["Google News", "DuckDuckGo"], 
      ranking = "keyword" 
    } = req.body;

    if (!query) return res.status(400).json({ error: "Query is required" });

    console.log(`[SEARCH] Query: "${query}", Sources: ${sources.join(", ")}`);

    const searchTasks = [];
    if (sources.includes("Google News")) searchTasks.push(searchGoogleNews(query, regions, languages));
    
    if (sources.includes("DuckDuckGo") || sources.includes("Web Search")) {
      searchTasks.push((async () => {
        const tavilyResults = await searchTavily(query, (req as any).user.email);
        if (tavilyResults && tavilyResults.length > 0) return tavilyResults;
        return searchDuckDuckGo(query);
      })());
    }

    if (sources.includes("RSS")) searchTasks.push(searchRSS(query));

    const resultsBySource = await Promise.all(searchTasks);
    let combined = [];
    
    // Flatten and tag with individual source info if needed
    for (const sourceResult of resultsBySource) {
      if (Array.isArray(sourceResult)) {
        combined.push(...sourceResult);
      }
    }

    // Deduplicate by URL
    const seen = new Set();
    combined = combined.filter(item => {
      if (!item.url) return false;
      // Normalize URL (strip trailing slash)
      const normalizedUrl = item.url.replace(/\/$/, "");
      const isDuplicate = seen.has(normalizedUrl);
      seen.add(normalizedUrl);
      return !isDuplicate;
    });

    console.log(`[SEARCH] Deduplicated to ${combined.length} total results`);

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    combined.sort((a, b) => {
      // 1. Recency priority if matches are equal
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();

      if (ranking === "recency") return dateB - dateA;

      // 2. Keyword relevance score
      const getScore = (item: any) => {
        let score = 0;
        const title = (item.title || "").toLowerCase();
        const snippet = (item.snippet || "").toLowerCase();
        
        for (const term of queryTerms) {
          if (title.includes(term)) score += 10;
          if (snippet.includes(term)) score += 2;
        }

        // Slight boost for diverse sources in top results
        if (item.source === "Tavily Web Search") score += 1;
        if (item.source === "RSS") score += 1;
        
        return score;
      };

      const scoreA = getScore(a);
      const scoreB = getScore(b);

      if (scoreA !== scoreB) return scoreB - scoreA;
      return dateB - dateA;
    });

    // Return more results
    const finalLimit = 999;
    res.json(combined.slice(0, finalLimit));
  } catch (error: any) {
    handleApiError(res, error, "search");
  }
});

// PROJECTS
apiRouter.get("/projects", authenticate, async (req: any, res) => {
  const userEmail = req.user.email;
  console.log(`[PROJECTS] Fetching projects for: ${userEmail}`);
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    handleApiError(res, error, "fetching projects");
  }
});

apiRouter.post("/projects", authenticate, async (req: any, res) => {
  try {
    const { name, query, settings } = req.body;
    if (!name) return res.status(400).json({ error: "Project name is required" });

    const { data, error } = await supabase
      .from("projects")
      .insert([{ 
        name, 
        query: query || "", 
        settings: settings || {}, 
        user_email: req.user.email,
        created_at: new Date().toISOString() 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    handleApiError(res, error, "creating project");
  }
});

apiRouter.get("/projects/:id", authenticate, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_email", req.user.email)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    handleApiError(res, error, "fetching individual project");
  }
});

apiRouter.patch("/projects/:id", authenticate, async (req: any, res) => {
  try {
    const { name, query, settings } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (query !== undefined) updateData.query = query;
    if (settings !== undefined) updateData.settings = settings;

    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", req.params.id)
      .eq("user_email", req.user.email)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    handleApiError(res, error, "updating project");
  }
});

apiRouter.delete("/projects/:id", authenticate, async (req: any, res) => {
  const idStr = req.params.id;
  const userEmail = req.user.email;
  try {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID must be a number" });

    await supabase.from("links").delete().eq("project_id", id);
    const { error, data } = await supabase
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_email", userEmail)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Project not found or permission denied");
    res.json({ success: true, id });
  } catch (error: any) {
    handleApiError(res, error, "deleting project");
  }
});

// LINKS
apiRouter.get("/links", authenticate, async (req: any, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    const { data: project, error: pError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_email", req.user.email)
      .single();
    
    if (pError || !project) return res.status(403).json({ error: "Unauthorized access to links" });

    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    handleApiError(res, error, "fetching links");
  }
});

apiRouter.post("/links", authenticate, async (req: any, res) => {
  try {
    const { project_id, url, title, snippet, source } = req.body;
    if (!project_id || !url) return res.status(400).json({ error: "project_id and url are required" });

    const { data: project, error: pError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_email", req.user.email)
      .single();
    
    if (pError || !project) return res.status(403).json({ error: "Unauthorized project access" });

    const { data, error } = await supabase
      .from("links")
      .insert([{ project_id, url, title: title || "", snippet: snippet || "", source: source || "", created_at: new Date().toISOString() }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    handleApiError(res, error, "creating link");
  }
});

apiRouter.delete("/links/:id", authenticate, async (req: any, res) => {
  try {
    const { data: link, error: lError } = await supabase
      .from("links")
      .select("*, projects!inner(user_email)")
      .eq("id", req.params.id)
      .single();

    if (lError || !link || (link.projects as any).user_email !== req.user.email) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { error } = await supabase.from("links").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error: any) {
    handleApiError(res, error, "deleting link");
  }
});

// Route catch-all for /api
apiRouter.all("*", (req, res) => {
  console.warn(`[API] 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// MOUNT ROUTER
app.use("/api", apiRouter);

// --- VITE MIDDLEWARE ---

// --- HELPERS ---
async function getEffectiveApiKey(userEmail: string, serviceName: string, envVarName: string): Promise<string | undefined> {
  try {
    const normalizedEmail = userEmail.toLowerCase();
    // 1. Try to get from database for this user
    const { data: dbKeys } = await supabase
      .from("api_keys")
      .select("key_value")
      .eq("service_name", serviceName)
      .eq("user_email", normalizedEmail)
      .limit(1);

    if (dbKeys && dbKeys.length > 0) {
      return decrypt(dbKeys[0].key_value);
    }

    // 2. Fallback to system env variable
    return process.env[envVarName];
  } catch (err) {
    console.error(`[AUTH] Error resolving ${serviceName} key for ${userEmail}:`, err);
    return process.env[envVarName];
  }
}

async function getLlmConfig(userEmail: string) {
  try {
    const normalizedEmail = userEmail.toLowerCase();
    const { data: userData } = await supabase
      .from("vault_users")
      .select("selected_llm_model")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    const apiKey = await getEffectiveApiKey(normalizedEmail, "nvidia", "NVIDIA_API_KEY");
    return {
        apiKey,
        modelId: userData?.selected_llm_model || null
    };
  } catch (err) {
    console.error("[LLM] Error fetching config:", err);
    return { apiKey: process.env.NVIDIA_API_KEY, modelId: null };
  }
}

// ... existing routes ...

// --- SEARCH AGGREGATOR ---
async function searchGoogleNews(query: string, regions: string[] = ["Global"], languages: string[] = ["en"], retries: number = 1) {
  try {
    const regionMap: Record<string, string> = {
      "US": "US", "GB": "GB", "IN": "IN", "CA": "CA", "AU": "AU", 
      "IL": "IL", "PK": "PK", "FR": "FR", "DE": "DE", "CN": "CN", 
      "JP": "JP", "BR": "BR", "Global": "US"
    };

    const langMap: Record<string, string> = {
      "en": "en", "es": "es", "fr": "fr", "de": "de", "zh": "zh-CN", 
      "ja": "ja", "he": "he", "ur": "ur", "ar": "ar", "hi": "hi",
      "tr": "tr", "vi": "vi", "ru": "ru", "ko": "ko"
    };

    // Construct search tasks for each combination of region and language
    const selectedRegions = regions.length > 0 ? regions : ["Global"];
    const selectedLangs = languages.length > 0 ? languages : ["en"];

    // Prioritize: always include Global + English if not present, as it has most index
    const priorityPairs = [];
    
    // Add primary combinations
    for (const r of selectedRegions.slice(0, 5)) {
      for (const l of selectedLangs.slice(0, 5)) {
        priorityPairs.push({ r, l });
      }
    }

    // Add a few more if needed but limit total requests to avoid blocking/slowdown
    const tasksTotal = priorityPairs.slice(0, 15);

    const searchTasks = tasksTotal.map(pair => (async () => {
      try {
        const gl = regionMap[pair.r] || "US";
        const hl = langMap[pair.l] || "en";
        const ceid = `${hl}:${gl}`;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8"
          },
          signal: AbortSignal.timeout(5000) // 5s timeout per request
        });

        if (!response.ok) return [];
        const xml = await response.text();
        const feed = await rssParser.parseString(xml);
        return feed.items.map(item => ({
          title: item.title || "",
          url: item.link || "",
          snippet: item.contentSnippet || "",
          source: "Google News",
          language: pair.l,
          region: pair.r,
          date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
        }));
      } catch (e) {
        return [];
      }
    })());

    const allResults = await Promise.all(searchTasks);
    return allResults.flat();
  } catch (err) {
    console.error("Google News search error:", err);
    return [];
  }
}

async function searchDuckDuckGo(query: string) {
  try {
    // Attempt DuckDuckGo HTML version
    const { data } = await axios.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 5000
    });
    
    const $ = cheerio.load(data);
    const results: any[] = [];

    $('.result').each((i, el) => {
      if (i >= 100) return;
      const title = $(el).find('.result__a').text().trim(); // Selector updated for reliability
      const url = $(el).find('.result__url').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      
      if (title && url) {
        results.push({
          title,
          url: url.startsWith('http') ? url : `https://${url}`,
          snippet,
          source: "DuckDuckGo",
          language: "en", // Default for DDG scraping in this context
          region: "Global",
          date: new Date().toISOString()
        });
      }
    });

    // If no results, try another selector set
    if (results.length === 0) {
      $('.links_main').each((i, el) => {
        if (i >= 100) return;
        const title = $(el).find('a.result__a').text().trim();
        const url = $(el).find('a.result__a').attr('href');
        const snippet = $(el).closest('.result').find('.result__snippet').text().trim();
        if (title && url) {
          results.push({
            title,
            url: url.startsWith('http') ? url : `https://${url}`,
            snippet,
            source: "DuckDuckGo",
            language: "en",
            region: "Global",
            date: new Date().toISOString()
          });
        }
      });
    }

    return results;
  } catch (err) {
    console.error("DuckDuckGo search error:", err);
    return [];
  }
}

async function searchTavily(query: string, userEmail?: string) {
  if (!userEmail) return null;
  
  console.log(`[TAVILY] Starting search for: "${query}" (User: ${userEmail})`);
  
  const apiKey = await getEffectiveApiKey(userEmail, "tavily", "TAVILY_API_KEY");
  
  if (!apiKey) {
    console.warn(`[TAVILY] No API key provided for user: ${userEmail}. Skipping Tavily.`);
    return null;
  }

  console.log(`[TAVILY] Using key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);

  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: apiKey,
      query: query,
      search_depth: "advanced",
      include_images: false,
      include_answer: false,
      max_results: 100
    });

    console.log(`[TAVILY] Success! Found ${response.data.results?.length || 0} results.`);

    return (response.data.results || []).map((item: any) => ({
      title: item.title,
      url: item.url,
      snippet: item.content,
      source: "Tavily Web Search",
      language: "en", // Tavily default
      region: "Global",
      date: item.published_date || new Date().toISOString()
    }));
  } catch (err: any) {
    console.error("[TAVILY] Search error:", err.response?.data || err.message);
    return null;
  }
}

async function searchRSS(query: string) {
  const commonFeeds = [
    "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://feeds.reuters.com/reuters/topNews",
    "https://www.aljazeera.com/xml/rss/all.xml",
    "https://abcnews.go.com/abcnews/topstories",
    "https://www.theguardian.com/world/rss",
    "https://techcrunch.com/feed/",
    "https://www.ft.com/?format=rss",
    "https://www.economist.com/sections/international/rss.xml",
    "https://www.timesofisrael.com/feed/",
    "https://www.jpost.com/rss/rssfeeds.aspx?categoryid=1",
    "https://www.dawn.com/feeds/home/",
    "https://www.thenews.com.pk/rss/1/1",
    "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    "https://www.lemonde.fr/rss/une.xml",
    "https://www.spiegel.de/index.rss",
    "https://www.haaretz.com/cmlink/1.4552462",
    "https://www.trtworld.com/rss",
    "https://www.iran-daily.com/RSS",
    "https://www.tehrantimes.com/rss",
    "https://www.scmp.com/rss/91/feed",
    "https://www.japantimes.co.jp/feed/",
    "https://www.dw.com/en/top-stories/rss"
  ];

  try {
    const fetchTasks = commonFeeds.map(async (url) => {
      try {
        const feed = await rssParser.parseURL(url);
        const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        
        return feed.items
          .map(item => {
            const title = (item.title || "").toLowerCase();
            const content = (item.contentSnippet || item.content || "").toLowerCase();
            const text = `${title} ${content}`;
            
            // Score based on how many terms match
            const matchCount = searchTerms.filter(term => text.includes(term)).length;
            
            // Boost if exact term matches in title
            const exactMatch = title.includes(query.toLowerCase()) ? 5 : 0;
            
            return { item, matchScore: matchCount + exactMatch, feedTitle: feed.title };
          })
          .filter(res => res.matchScore > 0)
          .map(res => ({
            title: res.item.title || "",
            url: res.item.link || "",
            snippet: res.item.contentSnippet || "",
            source: `RSS: ${res.feedTitle || "News Feed"}`,
            language: "en", 
            region: "Global",
            date: res.item.pubDate ? new Date(res.item.pubDate).toISOString() : new Date().toISOString()
          }));
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(fetchTasks);
    return results.flat().slice(0, 200);
  } catch (err) {
    console.error("RSS search error:", err);
    return [];
  }
}

/*
TABLE SCHEMAS (Run these in Supabase SQL Editor if table missing errors occur)

CREATE TABLE vault_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'User',
  access_start_date TIMESTAMPTZ DEFAULT now(),
  access_end_date TIMESTAMPTZ DEFAULT (now() + interval '1 year'),
  selected_llm_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE llm_models (
  user_email TEXT NOT NULL,
  model_id TEXT NOT NULL,
  non_stream_works BOOLEAN DEFAULT false,
  stream_works BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_email, model_id)
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  key_value TEXT NOT NULL,
  service_name TEXT DEFAULT 'tavily',
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT DEFAULT '',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE links (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT DEFAULT '',
  snippet TEXT DEFAULT '',
  source TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
*/

function handleApiError(res: express.Response, error: any, context: string) {
  console.error(`[ERROR] ${context}:`, error?.message || error);
  if (error?.response?.data) {
    console.error(`[ERROR DATA] ${context}:`, error.response.data);
  }
  
  let message = "Unknown error occurred";
  if (error && typeof error === 'object') {
    // Axios error response data
    if (error.response?.data?.error?.message) {
      message = error.response.data.error.message;
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    } else {
      message = error.details || error.hint || JSON.stringify(error);
    }
    
    // Postgres codes
    if (error.code === "42P01") message = `Table missing in database. Please run the SQL commands provided.`;
    else if (error.code === "42703") message = `Column missing in database. Please update your schema.`;
  } else if (typeof error === 'string') {
    message = error;
  }
  
  res.status(500).json({ error: String(message), context, code: error?.code });
}

// --- VITE MIDDLEWARE ---
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

setupVite().then(() => {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Set server timeout to 5 minutes
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 310000;
});
