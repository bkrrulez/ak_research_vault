import React, { useState, useEffect } from "react";
import { Key, Plus, Trash2, MoreHorizontal, Edit, Activity, ShieldCheck, Database, AlertCircle, Eye, EyeOff } from "lucide-react";
import { ApiKey, fetchApiKeys, createApiKey, deleteApiKey, updateApiKey } from "../lib/api";
import Layout from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function SettingsPage() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
  });

  const [editFormData, setEditFormData] = useState({
    label: "",
    key_value: "",
  });

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApiKeys();
      setApiKeys(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Could not load API keys." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createApiKey(formData);
      toast({ title: "Success", description: "New API Key added successfully." });
      setIsDialogOpen(false);
      loadApiKeys();
      setFormData({ label: "", key_value: "" });
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
      loadApiKeys();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    try {
      await deleteApiKey(id);
      toast({ title: "Deleted", description: "API Key has been removed." });
      loadApiKeys();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const openEditDialog = (key: ApiKey) => {
    setEditingKey(key);
    setEditFormData({
      label: key.label,
      key_value: "", // Keep empty for security, only update if typed
    });
  };

  return (
    <Layout>
      <div className="space-y-8 p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">API Management</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Manage and secure your third-party intelligence access tokens.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-white border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px] h-10 px-6 border-2">
              Configuration Active
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-8 border-b border-slate-100">
            <div>
              <CardTitle className="text-xl font-bold text-primary">Tavily API Keys</CardTitle>
              <CardDescription className="text-sm">Safe storage for API credentials used by the cognitive research engine.</CardDescription>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white font-bold uppercase tracking-wider text-xs h-10 px-4">
                  <Plus className="mr-2 h-4 w-4" /> Add API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-primary">Add API Key</DialogTitle>
                  <DialogDescription>Enter the name and key to store it securely.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddKey} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API Name</label>
                    <Input 
                      placeholder="e.g. Tavily" 
                      value={formData.label}
                      onChange={e => setFormData({...formData, label: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API Key</label>
                    <Input 
                      type="password"
                      placeholder="Enter API Key" 
                      value={formData.key_value}
                      onChange={e => setFormData({...formData, key_value: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  
                  <DialogFooter className="pt-6">
                    <Button type="submit" className="w-full h-11 uppercase font-bold tracking-widest shadow-lg">Save API Key</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={!!editingKey} onOpenChange={(v) => !v && setEditingKey(null)}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-primary">Edit API Key</DialogTitle>
                  <DialogDescription>Update the API name or key.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateKey} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API Name</label>
                    <Input 
                      placeholder="API Name" 
                      value={editFormData.label}
                      onChange={e => setEditFormData({...editFormData, label: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">API Key (Optional)</label>
                    <Input 
                      type="password"
                      placeholder="Leave blank to keep current key" 
                      value={editFormData.key_value}
                      onChange={e => setEditFormData({...editFormData, key_value: e.target.value})}
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  
                  <DialogFooter className="pt-6">
                    <Button type="submit" className="w-full h-11 uppercase font-bold tracking-widest shadow-lg">Update API Key</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="w-[300px] text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-8">API Name</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">API Key</TableHead>
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
                    <TableCell colSpan={4} className="h-32 text-center text-slate-400">No API keys found.</TableCell>
                  </TableRow>
                ) : (
                  apiKeys.map((key) => (
                    <TableRow key={key.id} className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                      <TableCell className="pl-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 shadow-sm">
                            <Key size={18} />
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
      </div>
    </Layout>
  );
}
