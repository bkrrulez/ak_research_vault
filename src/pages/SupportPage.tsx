import React from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ExternalLink } from "lucide-react";

export default function SupportPage() {
  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <Card className="border-slate-200 shadow-sm overflow-hidden text-left">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 text-center">
            <CardTitle className="text-3xl font-black text-primary uppercase tracking-tighter mb-2">Technical Support (Not Active yet)</CardTitle>
            <CardDescription className="text-base text-center">We're here to help you with any issues or questions regarding AK Research Vault.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Email Support</h3>
                  <p className="text-sm text-slate-500 mb-4 tracking-tight">Send us an email and we'll get back to you within 24 hours.</p>
                  <Button variant="outline" className="w-full border-slate-200 font-bold uppercase tracking-widest text-[10px] h-10">
                    support@ak-vault.com
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 border-dashed">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                Documentation
                <ExternalLink size={16} className="text-slate-400" />
              </h3>
              <ul className="space-y-3">
                <li className="text-sm text-slate-600 hover:text-primary cursor-pointer flex items-center gap-2 font-medium group transition-all">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-150 transition-all"></span>
                  Getting Started Guide
                </li>
                <li className="text-sm text-slate-600 hover:text-primary cursor-pointer flex items-center gap-2 font-medium group transition-all">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-150 transition-all"></span>
                  Search Optimization Tips
                </li>
                <li className="text-sm text-slate-600 hover:text-primary cursor-pointer flex items-center gap-2 font-medium group transition-all">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-150 transition-all"></span>
                  API Key Configuration
                </li>
                <li className="text-sm text-slate-600 hover:text-primary cursor-pointer flex items-center gap-2 font-medium group transition-all">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-150 transition-all"></span>
                  User Management for Admins
                </li>
              </ul>
              <div className="mt-8 p-4 bg-white rounded-xl border border-slate-100 shadow-sm italic text-xs text-slate-500">
                "Our goal is to provide the best research environment for the modern analyst."
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
