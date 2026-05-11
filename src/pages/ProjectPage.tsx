import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Search, Link as LinkIcon, Share2, Activity, Database, Zap, Plus, Globe, Filter, List, Trash2, ExternalLink, Loader2, Languages, MoreVertical, LayoutGrid, BrainCircuit, Sparkles, Network } from "lucide-react";
import { Project, fetchProject, LinkItem, fetchLinks, deleteLink, executeSearch, addLink, updateProject, analyzeText, generateSemanticMap } from "../lib/api";
import Layout from "../components/Layout";
import { motion, AnimatePresence } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MultiSelect } from "@/components/ui/multi-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { KnowledgeGraph } from "../components/KnowledgeGraph";

type Tab = "search" | "links" | "graph";

const ALL_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "he", label: "Hebrew" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
  { value: "ko", label: "Korean" },
  { value: "tr", label: "Turkish" },
  { value: "vi", label: "Vietnamese" }
];

const ALL_REGIONS = [
  { value: "Global", label: "Global" },
  { value: "US", label: "USA" },
  { value: "GB", label: "UK" },
  { value: "IN", label: "India" },
  { value: "IL", label: "Israel" },
  { value: "PK", label: "Pakistan" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "CN", label: "China" },
  { value: "JP", label: "Japan" },
  { value: "BR", label: "Brazil" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" }
];

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [isLoading, setIsLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [allSearchResults, setAllSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [regions, setRegions] = useState<string[]>(ALL_REGIONS.map(r => r.value));
  const [languages, setLanguages] = useState<string[]>(ALL_LANGUAGES.map(l => l.value));
  const [sources, setSources] = useState<string[]>(["Google News", "Web Search", "RSS"]);
  const [ranking, setRanking] = useState("keyword");
  const [hasInitialSearched, setHasInitialSearched] = useState(false);
  const [analyzingResults, setAnalyzingResults] = useState<Record<string, { loading: boolean, text: string }>>({});
  const [isAnalyzingSemantic, setIsAnalyzingSemantic] = useState(false);
  const [semanticData, setSemanticData] = useState<{ nodes: any[], edges: any[] } | null>(null);

  const handleAnalyzeSemanticMap = async () => {
    if (!links || links.length === 0) {
      toast({ title: "Intelligence Vault Empty", description: "Add items to the vault before generating a semantic map.", variant: "destructive" });
      return;
    }
    
    setIsAnalyzingSemantic(true);
    // Note: We don't clear old data instantly so the user can still see something while it generates
    try {
      const data = await generateSemanticMap(links, project?.query || "General Research", id);
      if (!data) throw new Error("No data received from engine.");
      setSemanticData({
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        edges: Array.isArray(data.edges) ? data.edges : []
      });
      toast({ title: "Map Generated", description: "Semantic relationships extracted successfully." });
    } catch (err: any) {
      console.error("Semantic analysis error:", err);
      toast({ 
        variant: "destructive", 
        title: "Map Generation Failed", 
        description: err.message || "An error occurred during analysis. Check console for details." 
      });
    } finally {
      setIsAnalyzingSemantic(false);
    }
  };

  const handleAnalyzeResult = async (result: any) => {
    setAnalyzingResults(prev => ({ ...prev, [result.url]: { loading: true, text: "" } }));
    try {
      const { analysis } = await analyzeText(result.snippet || result.title, searchQuery);
      setAnalyzingResults(prev => ({ ...prev, [result.url]: { loading: false, text: analysis } }));
    } catch (err: any) {
      toast({ variant: "destructive", title: "Analysis Failed", description: err.message });
      setAnalyzingResults(prev => {
        const next = { ...prev };
        delete next[result.url];
        return next;
      });
    }
  };

  const languageNameMap: Record<string, string> = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German", 
    "zh": "Chinese", "ja": "Japanese", "it": "Italian", "pt": "Portuguese",
    "ru": "Russian", "ko": "Korean", "he": "Hebrew", "ur": "Urdu",
    "ar": "Arabic", "hi": "Hindi", "tr": "Turkish", "vi": "Vietnamese",
    "pl": "Polish", "nl": "Dutch", "id": "Indonesian"
  };

  const regionNameMap: Record<string, string> = {
    "Global": "Global", "US": "USA", "GB": "UK", "IN": "India", "CA": "Canada", 
    "AU": "Australia", "IL": "Israel", "PK": "Pakistan", "FR": "France",
    "DE": "Germany", "CN": "China", "JP": "Japan", "BR": "Brazil"
  };

  useEffect(() => {
    if (id) {
      setHasInitialSearched(false);
      setAllSearchResults([]);
      setSearchQuery("");
      setSearchError(null);
      setProject(null);
      setSemanticData(null);
      setLinks([]);
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (project && !hasInitialSearched) {
      setHasInitialSearched(true);
      
      const cached = project.settings || {};
      if (cached.lastResults) {
        setAllSearchResults(cached.lastResults);
        setSearchQuery(project.query || "");
        if (cached.lastLangs) setLanguages(cached.lastLangs);
        if (cached.lastRegs) setRegions(cached.lastRegs);
        if (cached.lastSources) setSources(cached.lastSources);
      } else if (project.query) {
        handleSearch(project.query);
      }
    }
  }, [project?.id, project?.query, hasInitialSearched]);

  // Sync filters to project settings on change
  useEffect(() => {
    if (id && project && hasInitialSearched && allSearchResults.length > 0) {
      const settings = {
        ...project.settings,
        lastLangs: languages,
        lastRegs: regions,
        lastSources: sources
      };
      updateProject(id, { settings }).catch(e => console.error("Filter sync error", e));
    }
  }, [languages, regions, sources]);

  // Client-side Filtered Results
  const filteredResults = React.useMemo(() => {
    return allSearchResults.filter(res => {
      // Logic: "Web Search" in filter should match both Web Search results and internal Tavily ones
      const matchSource = sources.includes(res.source) || 
                         sources.some(s => res.source.startsWith(s)) ||
                         (sources.includes("Web Search") && (res.source === "Tavily Web Search" || res.source === "Tavily" || res.source === "DuckDuckGo"));
      
      const matchLang = languages.includes(res.language);
      const matchRegion = regions.includes(res.region);
      return matchSource && matchLang && matchRegion;
    });
  }, [allSearchResults, languages, regions, sources]);

  async function loadData() {
    try {
      setIsLoading(true);
      if (!id) return;
      const [pData, lData] = await Promise.all([
        fetchProject(id),
        fetchLinks(id)
      ]);
      setProject(pData);
      setLinks(lData);
      
      // Load semantic map if it exists
      if (pData.semantic_map) {
        setSemanticData(pData.semantic_map);
      }
    } catch (err) {
      console.error("Failed to load project data", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(queryToUse?: string) {
    const q = queryToUse || searchQuery;
    if (!q || !id) return;

    const searchId = id; // Capture current project ID
    setIsSearching(true);
    setSearchError(null);
    try {
      // Fetch broadly (common languages/regions) if it's the first search or user requested
      const results = await executeSearch(q, { 
        regions, 
        languages, 
        sources, 
        ranking 
      });

      // Only update state if we are still on the same project
      if (id === searchId) {
        setAllSearchResults(results);
        
        // Save query and results to project settings
        const settings = {
          ...project?.settings,
          lastResults: results,
          lastLangs: languages,
          lastRegs: regions,
          lastSources: sources
        };

        updateProject(searchId, { 
          query: q,
          settings 
        }).then(updated => {
          if (id === searchId) setProject(updated);
        }).catch(err => console.error("Failed to save search state", err));
      }
    } catch (err: any) {
      if (id === searchId) setSearchError(err.message);
    } finally {
      if (id === searchId) setIsSearching(false);
    }
  }

  async function handleAddLink(result: any) {
    if (!id) return;
    try {
      const newLink = await addLink({
        project_id: parseInt(id, 10),
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        source: result.source
      });
      setLinks([newLink, ...links]);
      // Remove from search results locally once added to vault
      setAllSearchResults(prev => prev.filter(r => r.url !== result.url));
      toast({
        title: "Link added",
        description: "Successfully added to the project vault.",
      });
    } catch (err: any) {
      toast({
        title: "Error adding link",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  async function handleDelete(linkId: number) {
    try {
      await deleteLink(linkId.toString());
      setLinks(links.filter(l => l.id !== linkId));
      toast({
        title: "Link removed",
        description: "The link has been removed from the vault.",
      });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  const sourceOptions = [
    { value: "Google News", label: "Google News" },
    { value: "Web Search", label: "Web Search" },
    { value: "RSS", label: "RSS Feeds" },
  ];

  const renderSearchTab = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Search Header */}
      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-8">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter research query (e.g., 'Latest breakthroughs in solid state batteries')"
                className="pl-11 h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-indigo-500/10 focus:border-indigo-500"
              />
            </div>
            <Button 
              type="submit"
              disabled={isSearching}
              className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-slate-900/10 gap-2 shrink-0"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isSearching ? "Searching..." : "Execute Search"}
            </Button>
          </form>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Filter:</span>
              <MultiSelect className="h-9 min-w-32 max-w-[150px] bg-slate-50 text-[10px] uppercase font-bold" options={ALL_REGIONS} selected={regions} onChange={setRegions} placeholder="Regions" />
              <MultiSelect className="h-9 min-w-32 max-w-[180px] bg-slate-50 text-[10px] uppercase font-bold" options={ALL_LANGUAGES} selected={languages} onChange={setLanguages} placeholder="Languages" />
              <MultiSelect className="h-9 min-w-32 max-w-[150px] bg-slate-50 text-[10px] uppercase font-bold" options={sourceOptions} selected={sources} onChange={setSources} placeholder="Sources" />
            </div>
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1" />

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 group transition-all">
              <List className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              <select
                value={ranking}
                onChange={(e) => {
                  setRanking(e.target.value);
                  // Trigger re-search if query exists
                  if (searchQuery) handleSearch();
                }}
                className="text-[10px] bg-transparent font-bold text-slate-600 uppercase focus:outline-none cursor-pointer"
              >
                <option value="keyword">Relevance</option>
                <option value="recency">Recency</option>
              </select>
            </div>

            {filteredResults.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 animate-in fade-in zoom-in duration-300">
                <span className="text-[10px] font-black uppercase tracking-widest">{filteredResults.length} Results Found</span>
              </div>
            )}

            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setAllSearchResults([]);
                setSearchQuery("");
                setSearchError(null);
                setHasInitialSearched(false);
                if (id) {
                  updateProject(id, { settings: { ...project?.settings, lastResults: [] } })
                    .catch(e => console.error("Clear cache error", e));
                }
              }}
              className="text-[10px] font-bold text-slate-400 uppercase hover:bg-slate-100 transition-colors ml-auto gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">
          {searchError}
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        {isSearching ? (
          [1, 2, 3].map(i => (
            <Card key={i} className="h-40 border-slate-200 rounded-2xl animate-pulse" />
          ))
        ) : filteredResults.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium tracking-tight">
              {allSearchResults.length > 0 ? "No results match your active filters." : "Enter a query to start aggregating intelligence."}
            </p>
          </div>
        ) : (
          filteredResults.map((result, idx) => {
            const isAlreadyAdded = links.some(l => l.url === result.url);
            return (
              <motion.div 
                key={result.url + idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-slate-200 shadow-sm hover:border-indigo-500/30 transition-all group overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                  <div className="absolute top-4 left-6 flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-[10px] font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-slate-100">
                    {idx + 1}
                  </div>
                  
                  <CardHeader className="p-6 pb-0 pl-16">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border-none">
                          {result.source}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-slate-200">
                          {result.language?.toUpperCase()}
                        </Badge>
                        {isAlreadyAdded && (
                          <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-green-50 text-green-700 border-none">
                            Stored in Vault
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        {new Date(result.date).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      {result.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">
                      {result.snippet}
                    </p>

                    {analyzingResults[result.url] && (
                      <div className="mb-6 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100/50 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                          <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">IA Intelligence Synthesis</span>
                        </div>
                        {analyzingResults[result.url].loading ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Processing high-density data...</span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {analyzingResults[result.url].text}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="secondary" size="sm" asChild className="h-8 text-[10px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200">
                        <a href={result.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open
                        </a>
                      </Button>
                      {!isAlreadyAdded && (
                        <Button 
                          size="sm" 
                          onClick={() => handleAddLink(result)}
                          className="h-8 text-[10px] font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700"
                        >
                          <Plus className="w-3.5 h-3.5 mr-2" /> Add to project
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderLinksTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Intelligence Repository ({links.length})</h3>
        <Button variant="outline" size="sm" className="h-9 gap-2 text-[10px] font-bold uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5" /> Manual Entry
        </Button>
      </div>

      <div className="space-y-4">
        {links.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <LinkIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium tracking-tight">No intelligence captured yet. Aggregate results from the search engine.</p>
          </div>
        ) : (
          links.map((link, idx) => (
            <motion.div 
              key={link.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-slate-200 shadow-sm hover:border-indigo-500/30 transition-all group overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                <div className="absolute top-4 left-6 flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-[10px] font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-slate-100">
                  {idx + 1}
                </div>
                
                <CardHeader className="p-6 pb-0 pl-16">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border-none">
                        {link.source}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-slate-200">
                        VAULT ITEM
                      </Badge>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      {new Date(link.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                    {link.title || link.url}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">
                    {link.snippet || "No snippet available for this record."}
                  </p>
                  <div className="flex gap-3">
                    <Button variant="secondary" size="sm" asChild className="h-8 text-[10px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200">
                      <a href={link.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(link.id)}
                      className="h-8 text-[10px] font-bold uppercase tracking-wider border-2 border-red-50 text-red-600 hover:bg-red-50 hover:border-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Item
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const renderGraphTab = () => (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Metric Header Row */}
      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entities</span>
                <span className="text-2xl font-bold text-slate-900 leading-none">{semanticData?.nodes?.length || 0}</span>
              </div>
              <div className="w-px h-10 bg-slate-100" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Relationships</span>
                <span className="text-2xl font-bold text-slate-900 leading-none">{semanticData?.edges?.length || 0}</span>
              </div>
            </div>

            <Button 
              onClick={handleAnalyzeSemanticMap}
              disabled={isAnalyzingSemantic || links.length === 0}
              className="px-8 h-12 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 gap-2 min-w-[200px]"
            >
              {isAnalyzingSemantic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAnalyzingSemantic ? "Synthesizing..." : "Analyze Results"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAnalyzingSemantic ? (
        <div className="py-32 flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center border-8 border-indigo-50 shadow-inner">
              <BrainCircuit className="w-12 h-12 text-indigo-500" />
            </div>
            <div className="absolute -inset-6 border-2 border-indigo-500/20 rounded-full animate-[spin_8s_linear_infinite]" />
            <div className="absolute -inset-2 border-b-2 border-indigo-500 rounded-full animate-[spin_3s_ease-in-out_infinite]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-slate-900">Neural Network Synthesis</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Extracting entities and mapping high-dimensional relationship vectors from project intelligence...
            </p>
          </div>
        </div>
      ) : semanticData ? (
        <div className="space-y-12">
          {/* Insights Grid */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 font-bold tracking-widest uppercase">Intelligence Clusters</Badge>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {semanticData.nodes.filter(n => n && n.id).map((node, idx) => (
                <motion.div
                  key={node.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <Card className="border-slate-200 shadow-sm hover:shadow-lg transition-all group overflow-hidden border-t-4 border-t-indigo-500 h-full">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{node.type || 'Entity'}</span>
                        <Network className="w-4 h-4 text-slate-200 group-hover:text-indigo-400 transition-colors" />
                      </div>
                      <CardTitle className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                        {node.label || node.id || 'Unknown'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                        {semanticData.edges
                          .filter(e => e && (e.source === node.id || e.target === node.id))
                          .map((edge, eidx) => {
                            const otherId = edge.source === node.id ? edge.target : edge.source;
                            const otherLabel = semanticData.nodes.find(n => n.id === otherId)?.label || otherId;
                            return (
                              <div key={eidx} className="flex items-start gap-2 text-[10px] py-1.5 border-b border-slate-50 last:border-0">
                                <Activity className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="font-bold text-indigo-600 uppercase tracking-tighter leading-none">{edge.relation || 'LINKED TO'}</span>
                                  <span className="text-slate-600 font-medium truncate">{otherLabel}</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Knowledge Graph Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-amber-50 text-amber-600 font-bold tracking-widest uppercase">Connection Web</Badge>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <Card className="rounded-[2.5rem] border-slate-200 shadow-xl overflow-hidden bg-slate-900 border-8 border-slate-800">
              <CardHeader className="bg-slate-800/50 p-6 border-b border-slate-700/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white">Project Semantic Network</CardTitle>
                  <CardDescription className="text-slate-400">Interactive force-directed graph. Drag nodes to explore, scroll to zoom.</CardDescription>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Person</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Org</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Concept</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-slate-950 relative">
                <KnowledgeGraph 
                  nodes={semanticData.nodes} 
                  edges={semanticData.edges} 
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="py-40 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-white border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-6">
            <Share2 className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">Network Engine Standby</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-8">
            Intelligence vault contains {links.length} items. Synthesize them into a semantic knowledge map.
          </p>
          <Button 
            onClick={handleAnalyzeSemanticMap}
            disabled={links.length === 0}
            variant="outline"
            className="h-11 px-8 rounded-xl border-2 border-slate-200 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-all gap-2"
          >
            <Zap className="w-4 h-4" />
            Initialize Analysis
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Layout 
      activeProjectId={id} 
      projectName={project?.name} 
      projectCode={`AK-${String(id || '').toUpperCase()}`}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <Tabs defaultValue="search" className="flex flex-col h-full" onValueChange={(val) => setActiveTab(val as Tab)}>
          <div className="px-8 bg-white border-b border-slate-200 shrink-0">
            <TabsList className="justify-start h-auto p-0 bg-transparent gap-8">
              <TabsTrigger 
                value="search" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                Search Engine
              </TabsTrigger>
              <TabsTrigger 
                value="links" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Intelligence Vault ({links.length})
              </TabsTrigger>
              <TabsTrigger 
                value="graph" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent data-[state=active]:text-indigo-600 data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                Semantic Map
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <ScrollArea className="h-full">
              <div className={`p-8 ${activeTab === 'graph' ? 'max-w-[95%]' : 'max-w-6xl'} mx-auto min-h-full transition-all duration-500`}>
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-[1px] z-10">
                    <div className="flex flex-col items-center gap-4">
                      <Activity className="w-10 h-10 text-indigo-400 animate-spin" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Synchronizing Workspace...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <TabsContent value="search" className="m-0 mt-0 focus-visible:ring-0">
                      {renderSearchTab()}
                    </TabsContent>
                    <TabsContent value="links" className="m-0 mt-0 focus-visible:ring-0">
                      {renderLinksTab()}
                    </TabsContent>
                    <TabsContent value="graph" className="m-0 mt-0 focus-visible:ring-0">
                      {renderGraphTab()}
                    </TabsContent>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
