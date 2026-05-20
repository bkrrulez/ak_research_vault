import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { User, Key, Save, Loader2, MoreVertical, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { fetchProfile, changePassword, VaultUser } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProfilePage() {
  const [profile, setProfile] = useState<VaultUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const { toast } = useToast();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const loadProfile = async () => {
    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Could not load profile." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 6 characters." });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast({ title: "Success", description: "Password updated successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsPasswordDialogOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 p-8 max-w-7xl mx-auto">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <CardTitle className="text-xl font-bold text-primary">My Account</CardTitle>
              <CardDescription className="text-sm">View your personal account details and access information.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="w-[300px] text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-8">User</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Role</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Access Start</TableHead>
                  <TableHead className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Access End</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile && (
                  <TableRow className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200 overflow-hidden shadow-sm">
                          <User size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{profile.full_name}</span>
                          <span className="text-xs text-slate-500 font-medium">{profile.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        profile.role === "Admin" 
                          ? "bg-primary/10 text-primary border border-primary/20" 
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        {profile.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 font-medium">
                      {profile.access_start_date ? format(new Date(profile.access_start_date), "MMM d, yyyy") : "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 font-medium">
                      {profile.access_end_date ? format(new Date(profile.access_end_date), "MMM d, yyyy") : "N/A"}
                    </TableCell>
                    <TableCell className="pr-8">
                      {!profile.is_system_admin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-xl border-slate-100">
                            <DropdownMenuItem 
                              onClick={() => setIsPasswordDialogOpen(true)}
                              className="px-3 py-3 rounded-xl cursor-pointer hover:bg-slate-50 text-slate-600 font-bold uppercase tracking-widest text-[10px] gap-3"
                            >
                              <Key className="w-4 h-4 text-slate-400" />
                              Change Password
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Change Password Dialog */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-slate-50/50 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Secure Update</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Update your password to keep your analytical vault strictly private.
              </DialogDescription>
            </DialogHeader>
            <div className="p-8">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Current Password</label>
                  <Input 
                    type="password"
                    placeholder="Verification required"
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    required
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">New Password</label>
                  <Input 
                    type="password"
                    placeholder="Min. 6 characters"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    required
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Verify Password</label>
                  <Input 
                    type="password"
                    placeholder="Confirm precision"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    required
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/20"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isChangingPassword}
                  className="w-full h-14 mt-6 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-[0.98] gap-3"
                >
                  {isChangingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Finalize Change
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
