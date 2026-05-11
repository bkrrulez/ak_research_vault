import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { UserPlus, User, Trash2, MoreHorizontal, Edit } from "lucide-react";
import { format } from "date-fns";
import { fetchUsers, createVaultUser, deleteVaultUser, updateVaultUser, VaultUser } from "@/lib/api";

export default function MembersPage() {
  const { user: activeUser } = useAuth();
  const [users, setUsers] = useState<VaultUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<VaultUser | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "User" as "Admin" | "User",
    access_start_date: format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd"),
    access_end_date: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), "yyyy-MM-dd"),
  });

  const [editFormData, setEditFormData] = useState({
    email: "",
    full_name: "",
    role: "User" as "Admin" | "User",
    access_start_date: "",
    access_end_date: "",
  });

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load user list." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVaultUser(formData);
      
      toast({ title: "Success", description: "New user added successfully." });
      setIsDialogOpen(false);
      loadUsers();
      setFormData({
        email: "",
        full_name: "",
        password: "",
        role: "User",
        access_start_date: format(new Date(), "yyyy-MM-dd"),
        access_end_date: format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), "yyyy-MM-dd"),
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateVaultUser(editingUser.id, editFormData);
      toast({ title: "Success", description: "User details updated successfully." });
      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    try {
      await deleteVaultUser(id);
      toast({ title: "Removed", description: "User has been removed from the vault." });
      loadUsers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const openEditDialog = (user: VaultUser) => {
    setEditingUser(user);
    setEditFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      access_start_date: format(new Date(user.access_start_date), "yyyy-MM-dd"),
      access_end_date: format(new Date(user.access_end_date), "yyyy-MM-dd"),
    });
  };

  return (
    <Layout>
      <div className="space-y-8 p-8 max-w-7xl mx-auto">
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px] h-9">
            All Users
          </Button>
          <Button variant="ghost" className="text-slate-500 font-bold uppercase tracking-wider text-[10px] h-9">
            User Access
          </Button>
        </div>

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <CardTitle className="text-xl font-bold text-primary">All Users</CardTitle>
              <CardDescription className="text-sm">A list of all users you have permission to view.</CardDescription>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white font-bold uppercase tracking-wider text-xs h-10 px-4">
                  <UserPlus className="mr-2 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-primary">Add New User</DialogTitle>
                  <DialogDescription>Fill in the details below to add a new user to the vault.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                    <Input 
                      placeholder="John Doe" 
                      value={formData.full_name}
                      onChange={e => setFormData({...formData, full_name: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Email Address</label>
                    <Input 
                      type="email" 
                      placeholder="john.doe@example.com" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Password</label>
                    <Input 
                      type="password" 
                      placeholder="Create a password" 
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Role</label>
                      <Select onValueChange={(v: any) => setFormData({...formData, role: v})} value={formData.role}>
                        <SelectTrigger className="bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Access Start Date</label>
                      <Input 
                        type="date" 
                        value={formData.access_start_date}
                        onChange={e => setFormData({...formData, access_start_date: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Access End Date</label>
                      <Input 
                        type="date" 
                        value={formData.access_end_date}
                        onChange={e => setFormData({...formData, access_end_date: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-6">
                    <Button type="submit" className="w-full h-11 uppercase font-bold tracking-widest shadow-lg">Save User</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={!!editingUser} onOpenChange={(v) => !v && setEditingUser(null)}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-primary">Edit User</DialogTitle>
                  <DialogDescription>Update the details below to modify user access.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                    <Input 
                      placeholder="Full Name" 
                      value={editFormData.full_name}
                      onChange={e => setEditFormData({...editFormData, full_name: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Email Address</label>
                    <Input 
                      type="email" 
                      placeholder="Email" 
                      value={editFormData.email}
                      onChange={e => setEditFormData({...editFormData, email: e.target.value})}
                      required
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Role</label>
                      <Select onValueChange={(v: any) => setEditFormData({...editFormData, role: v})} value={editFormData.role}>
                        <SelectTrigger className="bg-slate-50 border-slate-200">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Access Start Date</label>
                      <Input 
                        type="date" 
                        value={editFormData.access_start_date}
                        onChange={e => setEditFormData({...editFormData, access_start_date: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Access End Date</label>
                      <Input 
                        type="date" 
                        value={editFormData.access_end_date}
                        onChange={e => setEditFormData({...editFormData, access_end_date: e.target.value})}
                        required
                        className="bg-slate-50 border-slate-200"
                      />
                    </div>
                  </div>

                  <DialogFooter className="pt-6">
                    <Button type="submit" className="w-full h-11 uppercase font-bold tracking-widest shadow-lg">Update User</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="w-[300px] text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-8">User</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Role</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Access Start</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Access End</TableHead>
                  <TableHead className="w-[100px] text-right pr-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400">Loading users...</TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400">No users found.</TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                      <TableCell className="pl-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 overflow-hidden shadow-sm">
                            <User size={20} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{user.full_name}</span>
                            <span className="text-xs text-slate-500 font-medium">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.role === "Admin" 
                            ? "bg-primary/10 text-primary border border-primary/20" 
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 font-medium">
                        {format(new Date(user.access_start_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 font-medium">
                        {format(new Date(user.access_end_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        {!user.is_system_admin && (
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
                                onClick={() => openEditDialog(user)}
                                className="font-bold uppercase tracking-widest text-[10px] py-3 cursor-pointer"
                              >
                                <Edit className="mr-2 h-4 w-4 text-slate-400" />
                                Modify
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteUser(user.id)}
                                className="font-bold uppercase tracking-widest text-[10px] py-3 cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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
