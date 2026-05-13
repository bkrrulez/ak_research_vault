import React, { useState, useEffect } from "react";
import { Plus, Search, Folder, Calendar, ArrowRight, Settings, ChevronRight, Activity, Trash2, Eye, EyeOff, Edit2, Key, Save, X, ChevronLeft, LogOut, User, Users, Shield, Bell } from "lucide-react";
import { Project, fetchProjects, createProject, deleteProject, ApiKey, fetchApiKeys, createApiKey, deleteApiKey, updateApiKey } from "../lib/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/auth";
import { Logo } from "./Logo";
import { Footer } from "./Footer";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
  activeProjectId?: string;
  projectName?: string;
  projectCode?: string;
}

export default function Layout({ children, activeProjectId, projectName, projectCode }: LayoutProps) {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{id: string, name: string} | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  
  const location = useLocation();
  const navigate = useNavigate();

  // Settings Panel State
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    const saved = localStorage.getItem("isSettingsOpen");
    if (saved !== null) return saved === "true";
    return location.pathname.startsWith("/settings") || location.pathname === "/members";
  });

  useEffect(() => {
    localStorage.setItem("isSettingsOpen", String(isSettingsOpen));
  }, [isSettingsOpen]);

  useEffect(() => {
    if (location.pathname.startsWith("/settings") || location.pathname === "/members") {
      setIsSettingsOpen(true);
    }
  }, [location.pathname]);

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  const isSettingsPath = location.pathname.startsWith("/settings/");
  const isMembersPath = location.pathname.startsWith("/members");
  const isDashboardPath = location.pathname === "/";

  const [isLoading, setIsLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    loadApiKeys();
  }, []);

  async function loadProjects() {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err: any) {
      console.error("Failed to load projects", err);
    }
  }

  async function loadApiKeys() {
    try {
      const data = await fetchApiKeys();
      setApiKeys(data);
    } catch (err: any) {
      console.error("Failed to load API keys", err);
    }
  }

  const sidebarProjects = [...projects]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const project = await createProject({ name: newProjectName });
      setProjects([project, ...projects]);
      setNewProjectName("");
      setIsModalOpen(false);
      navigate(`/project/${project.id}`);
    } catch (err: any) {
      console.error("Error creating project:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteProject(idStr: string, name: string, e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setProjectToDelete({ id: String(idStr), name });
    setIsDeleteModalOpen(true);
  }

  async function performDelete() {
    if (!projectToDelete) return;
    
    const id = projectToDelete.id;
    setIsLoading(true);
    setError(null);
    setDeleteSuccess(false);
    
    try {
      await deleteProject(id);
      setDeleteSuccess(true);
      
      setTimeout(() => {
        setProjects((prev) => prev.filter((p) => String(p.id) !== id));
        if (activeProjectId && String(activeProjectId) === id) {
          navigate("/", { replace: true });
        }
        setIsDeleteModalOpen(false);
        setProjectToDelete(null);
        setDeleteSuccess(false);
      }, 1500);
      
    } catch (err: any) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <aside className="w-64 bg-white flex flex-col border-r border-slate-200 shrink-0 z-20 shadow-sm">
        <Link to="/" className="p-6 pb-2 flex items-center hover:opacity-80 transition-opacity">
          <Logo size="sm" />
        </Link>
        
        <nav className="flex-1 flex flex-col pt-6 overflow-hidden">
          <div className="px-4 mb-6">
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/10 h-11 uppercase font-bold tracking-widest text-[10px]"
              size="sm"
            >
              <Plus className="w-4 h-4 text-white/70" />
              <span>Add Project</span>
            </Button>
          </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-7 mb-3">
              <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Streams</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-1 py-2 px-2 flex flex-col">
                {sidebarProjects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] transition-all cursor-pointer ${
                      String(activeProjectId) === String(p.id) 
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                        : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
                    }`}
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${String(activeProjectId) === String(p.id) ? "text-white/80" : "text-slate-400"}`} />
                      <span className="truncate font-bold uppercase tracking-widest block flex-1">{p.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className={`mt-auto border-t border-slate-100 transition-all duration-300 ${isSettingsOpen ? 'bg-slate-50/80 p-2 pt-4' : 'p-2'}`}>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <Settings className={`w-4 h-4 ${isSettingsOpen ? 'text-primary' : 'text-slate-400'} transition-all`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isSettingsOpen ? 'text-primary' : 'text-slate-500'} group-hover:text-primary`}>Control Center</span>
            </div>
            <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-1 space-y-1 px-2 flex flex-col"
              >
                <Link 
                  to="/settings/tavily"
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group border ${
                    location.pathname === "/settings/tavily" 
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                      : 'hover:bg-white/50 text-slate-500 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Key className={`w-3.5 h-3.5 shrink-0 ${location.pathname === "/settings/tavily" ? 'text-white' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate block flex-1">API Management</span>
                  </div>
                </Link>

                <Link 
                  to="/settings/llm"
                  className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group border ${
                    location.pathname === "/settings/llm" 
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                      : 'hover:bg-white/50 text-slate-500 hover:text-slate-900 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Shield className={`w-3.5 h-3.5 shrink-0 ${location.pathname === "/settings/llm" ? 'text-white' : 'text-slate-400'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider truncate block flex-1">LLM Management</span>
                  </div>
                </Link>

                {user?.role === "Admin" && (
                  <Link 
                    to="/members"
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group border ${
                      isMembersPath 
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                        : 'hover:bg-white/50 text-slate-500 hover:text-slate-900 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <Users className={`w-3.5 h-3.5 shrink-0 ${isMembersPath ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider truncate block flex-1">User Management</span>
                    </div>
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-slate-100 mt-2 bg-white">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group border border-slate-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] text-primary font-black shadow-sm transition-all group-hover:bg-primary group-hover:text-white">
                  {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('') : "BE"}
                </div>
                <div className="text-left flex-1 overflow-hidden">
                  <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tighter leading-tight">{user?.full_name || "Guest"}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{user?.role || "Researcher"}</p>
                </div>
                <LogOut className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); handleLogout(); }} />
              </button>
            </DropdownMenuTrigger>
          </DropdownMenu>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0 z-10 shadow-sm">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter truncate max-w-[500px]">
              {location.pathname === "/settings/tavily" ? "API Management" : 
               location.pathname === "/settings/llm" ? "LLM Management" : 
               isMembersPath ? "User Management" : 
               isDashboardPath ? "Dashboard Overview" : (projectName || "Project View")}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {projectCode && !isSettingsPath && !isMembersPath && (
                <span className="px-2 py-0.5 bg-primary/5 text-primary border border-primary/10 rounded-md text-[9px] font-black uppercase tracking-widest leading-none">
                  S-ID: {projectCode}
                </span>
              )}
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                ACTIVE SESSION: {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 mr-4 pr-4 border-r border-slate-200">
              <button className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 transition-all cursor-pointer">
                <Bell size={20} />
              </button>
            </div>
            {location.pathname !== "/" && activeProjectId && !isSettingsPath && !isMembersPath && (
              <Button 
                variant="outline"
                onClick={(e) => handleDeleteProject(activeProjectId, projectName || "this project", e)}
                className="h-10 px-6 text-[10px] font-bold uppercase tracking-widest border-slate-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-100 gap-2 shadow-sm rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
                Archive
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 relative flex flex-col">
          <div className="flex-1">
            {children}
          </div>
        </div>

        <footer className="h-12 bg-white border-t border-slate-200 px-8 flex items-center justify-between text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] shrink-0">
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full border border-green-100">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> 
              Core Sync Ready
            </span>
            <span className="flex items-center gap-2">
              <Shield size={12} className="text-primary" />
              Protection: Active ({user?.role})
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="font-bold normal-case tracking-normal text-[10px]">Created by Bikramjit Chowdhury, Die Universität für angewandte Kunst Wien</span>
            <span className="h-4 w-px bg-slate-200 mx-2" />
            <span>Node: RESEARCH-VAULT-PRIMARY</span>
          </div>
        </footer>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md p-8 rounded-2xl">
          <DialogHeader className="space-y-4">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2 shadow-inner">
              <Plus size={32} />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter text-left">Initiate Stream</DialogTitle>
            <DialogDescription className="text-slate-500 font-medium text-left">
              Create a new intelligence stream to aggregate research.
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold uppercase tracking-widest text-center mt-2">
              {error}
            </div>
          )}
          
          <form onSubmit={handleCreateProject} className="space-y-6 pt-4">
            <div className="space-y-3 px-1">
              <label htmlFor="project-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Stream Descriptor
              </label>
              <Input
                autoFocus
                id="project-name"
                placeholder="Market Intelligence Alpha"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="h-12 bg-slate-50 border-slate-200 focus:bg-white text-sm font-bold rounded-xl transition-all"
              />
            </div>
            <DialogFooter className="flex gap-3 sm:gap-0 pt-4">
              <Button
                type="submit"
                disabled={isLoading || !newProjectName.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-white uppercase tracking-widest text-[11px] font-black h-12 shadow-xl shadow-primary/20 rounded-xl"
              >
                {isLoading ? "Synchronizing..." : "Initialize Stream"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => !isLoading && setIsDeleteModalOpen(open)}>
        <DialogContent className="sm:max-w-sm text-center p-8 rounded-2xl">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-500 ${deleteSuccess ? 'bg-green-100 text-green-600 shadow-lg shadow-green-100' : 'bg-red-50 text-red-600 shadow-xl shadow-red-50 border border-red-100'}`}>
            {deleteSuccess ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Activity className="w-10 h-10" />
              </motion.div>
            ) : (
              <Trash2 className="w-10 h-10" />
            )}
          </div>
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-black text-center text-slate-900 uppercase tracking-tighter">
              {deleteSuccess ? "Success" : "Archive Stream"}
            </DialogTitle>
            <DialogDescription className="text-center font-medium text-slate-500 leading-relaxed">
              {deleteSuccess 
                ? `Research stream successfully archived.`
                : <>Are you sure you want to archive <span className="font-black text-slate-900 italic">"{projectToDelete?.name}"</span>? This will remove all associated data mapping.</>
              }
            </DialogDescription>
          </DialogHeader>
          
          {!deleteSuccess && (
            <DialogFooter className="flex gap-4 pt-8 shrink-0">
              <Button
                variant="ghost"
                disabled={isLoading}
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 uppercase tracking-widest text-[11px] font-black h-12 text-slate-400 hover:text-slate-900"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={performDelete}
                disabled={isLoading}
                className="flex-1 uppercase tracking-widest text-[11px] font-black h-12 shadow-xl shadow-red-200 rounded-xl"
              >
                {isLoading ? "Archiving..." : "Archive"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
