import React, { useState, useEffect } from "react";
import { Key, Plus, Trash2, MoreHorizontal, Edit, Activity, ShieldCheck, Database, AlertCircle, Eye, EyeOff, Bot, RefreshCw, Save } from "lucide-react";
import { ApiKey, fetchApiKeys, createApiKey, deleteApiKey, updateApiKey, fetchLlmModels, selectLlmModel, startFetchNvidiaModels } from "../lib/api";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function LlmManagementPage() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [llmModels, setLlmModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasFallbackKey, setHasFallbackKey] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  
  const toggleKeyVisibility = (id: string) => {
    const next = new Set(visibleKeys);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleKeys(next);
  };

  const [formData, setFormData] = useState({
    label: "",
    key_value: "",
    service_name: "nvidia"
  });

  const [editFormData, setEditFormData] = useState({
    label: "",
    key_value: "",
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [keys, modelsData] = await Promise.all([
        fetchApiKeys("nvidia"),
        fetchLlmModels()
      ]);
      console.log("[LLM] Loaded models data:", modelsData);
      setApiKeys(keys);
      setLlmModels(modelsData.models);
      setHasFallbackKey(!!modelsData.hasFallbackKey);
      
      const savedModel = modelsData.selectedModel || "";
      setSelectedModel(savedModel);
      
      // If we have a saved model but it's not in the models list yet, 
      // it might be because the models haven't been fetched/tested yet.
      // We still keep it as the selected value in the state.
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Could not load data." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const result = await startFetchNvidiaModels();
      toast({ 
        title: "Scan Complete", 
        description: `Tested up to 999 models. Verified and saved ${result.count} functional models.` 
      });
      // Refresh models list
      const modelsData = await fetchLlmModels();
      setLlmModels(modelsData.models);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fetch Error", description: err.message });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSaveModel = async () => {
    if (!selectedModel) return;
    setIsSavingModel(true);
    try {
      await selectLlmModel(selectedModel);
      toast({ title: "Model Saved", description: `Selected model ${selectedModel} is now active.` });
      // Reload to confirm it's persisted correctly
      await loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save Error", description: err.message });
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createApiKey(formData);
      toast({ title: "Success", description: "New NVIDIA API Key added successfully." });
      setIsDialogOpen(false);
      loadData();
      setFormData({ label: "", key_value: "", service_name: "nvidia" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleUpdateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;
    try {
      await updateApiKey(editingKey.id, editFormData);
      toast({ title: "Success", description: "API Key updated successfully." });
      setEditingKey(null);
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this NVIDIA API key?")) return;
    try {
      await deleteApiKey(id);
      toast({ title: "Deleted", description: "API Key has been removed." });
      loadData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const openEditDialog = (key: ApiKey) => {
    setEditingKey(key);
    setEditFormData({
      label: key.label,
      key_value: "", 
    });
  };

  return (
    <Layout>
      <div className="space-y-8 p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">LLM Management</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Configure your Large Language Model provider credentials.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] h-10 px-6 border-2">
              Cognitive Engine Ready
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* API Keys Table */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-8 border-b border-slate-100">
              <div>
                <CardTitle className="text-xl font-bold text-primary">NVIDIA API Keys</CardTitle>
                <CardDescription className="text-sm">Manage access tokens for NVIDIA AI Foundation Models.</CardDescription>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-white font-bold uppercase tracking-wider text-xs h-10 px-4">
                    <Plus className="mr-2 h-4 w-4" /> Add NVIDIA Key
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-primary">Add NVIDIA Key</DialogTitle>
                    <DialogDescription>Enter your NVIDIA API credentials to enable custom LLM processing.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddKey} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Identifier Label</label>
                      <Input 
                        placeholder="e.g. Llama-3-70B Production" 
                        value={formData.label}
                        onChange={e => setFormData({...formData, label: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API Key (nvapi-...)</label>
                      <Input 
                        type="password"
                        placeholder="Enter NVIDIA API Key" 
                        value={formData.key_value}
                        onChange={e => setFormData({...formData, key_value: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                    
                    <DialogFooter className="pt-6">
                      <Button type="submit" className="w-full h-11 uppercase font-bold tracking-widest shadow-lg">Store in Vault</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={!!editingKey} onOpenChange={(v) => !v && setEditingKey(null)}>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-primary">Edit NVIDIA Key</DialogTitle>
                    <DialogDescription>Update the identifier or refresh the key.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateKey} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Identifier Label</label>
                      <Input 
                        placeholder="API Name" 
                        value={editFormData.label}
                        onChange={e => setEditFormData({...editFormData, label: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">New API Key (Optional)</label>
                      <Input 
                        type="password"
                        placeholder="Leave blank to keep current key" 
                        value={editFormData.key_value}
                        onChange={e => setEditFormData({...editFormData, key_value: e.target.value})}
                        className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                    
                    <DialogFooter className="pt-6">
                      <Button type="submit" className="w-full h-11 uppercase font-bold tracking-widest shadow-lg">Update Key</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="w-[300px] text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-8">Model Identifier</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Access Key</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Added Date</TableHead>
                    <TableHead className="w-[100px] text-right pr-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-slate-400">Loading keys...</TableCell>
                    </TableRow>
                  ) : apiKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-48 text-center bg-slate-50/30">
                        <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
                          <p className="text-slate-400 font-medium">No custom NVIDIA keys added to your profile.</p>
                          {hasFallbackKey ? (
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 mt-2">
                              <ShieldCheck size={12} />
                              System Fallback Active
                            </div>
                          ) : (
                            <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest">Action Required: Add key to enable synthesis</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    apiKeys.map((key) => (
                      <TableRow key={key.id} className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                        <TableCell className="pl-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 shadow-sm">
                              <Bot size={18} />
                            </div>
                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{key.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            <code className="bg-slate-50 px-2 py-1 rounded border border-slate-100">
                              {visibleKeys.has(key.id) ? key.key_value : "••••••••••••••••••••••••"}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-slate-400 hover:text-primary transition-colors"
                              onClick={() => toggleKeyVisibility(key.id)}
                            >
                              {visibleKeys.has(key.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 font-medium">
                          {format(new Date(key.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-primary transition-colors"
                              >
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem 
                                onClick={() => openEditDialog(key)}
                                className="font-bold uppercase tracking-widest text-[10px] py-3 cursor-pointer"
                              >
                                <Edit className="mr-2 h-4 w-4 text-slate-400" />
                                Modify
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteKey(key.id)}
                                className="font-bold uppercase tracking-widest text-[10px] py-3 cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Model Selection Table */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-primary">Select LLM Model</CardTitle>
              <CardDescription className="text-sm">Choose the working model for the intelligence engine.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="w-1/2 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-8 py-4">LLM Models</TableHead>
                    <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest py-4">Fetch Models</TableHead>
                    <TableHead className="text-right pr-8 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Save Model</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="pl-8 py-8">
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors">
                          <SelectValue placeholder={llmModels.length === 0 ? "No models available. Fetch first." : "Select Working Model"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {selectedModel && !llmModels.find(m => m.model_id === selectedModel) && (
                            <SelectItem value={selectedModel}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-400 italic">{selectedModel} (Saved)</span>
                              </div>
                            </SelectItem>
                          )}
                          {llmModels.map((m) => (
                            <SelectItem key={m.model_id} value={m.model_id}>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{m.model_id}</span>
                                {m.non_stream_works && m.stream_works ? (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-50 text-emerald-600">
                                    Full Engine
                                  </span>
                                ) : m.non_stream_works ? (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-blue-50 text-blue-600">
                                    Non-Stream
                                  </span>
                                ) : m.stream_works ? (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-purple-50 text-purple-600">
                                    Stream
                                  </span>
                                ) : null}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-8">
                      <Button 
                        onClick={handleFetchModels} 
                        disabled={isFetchingModels || (apiKeys.length === 0 && !hasFallbackKey)}
                        variant="outline" 
                        className="h-11 px-6 font-bold uppercase tracking-widest text-[10px] flex gap-2 border-2 border-slate-200 hover:border-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        {isFetchingModels ? <Activity size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {isFetchingModels ? "Testing..." : "Fetch Models"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right pr-8 py-8">
                      <Button 
                        onClick={handleSaveModel} 
                        disabled={isSavingModel || !selectedModel}
                        className={`h-11 px-8 font-black uppercase tracking-[0.2em] text-[10px] shadow-lg transition-all ${
                          selectedModel ? 'bg-primary hover:bg-primary/90 shadow-primary/20' : 'bg-slate-200'
                        }`}
                      >
                        {isSavingModel ? <Activity size={14} className="animate-spin" /> : <Save size={14} className="mr-2" />}
                        Save Model
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              {apiKeys.length === 0 && !hasFallbackKey && (
                <div className="m-8 mt-0 p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 font-medium leading-relaxed italic">
                    You must add an NVIDIA API key above before you can fetch and test available foundation models from the NVIDIA API.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
