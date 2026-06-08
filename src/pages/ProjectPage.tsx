import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Search, Link as LinkIcon, Share2, Activity, Database, Zap, Plus, Globe, Filter, List, Trash2, ExternalLink, Loader2, Languages, MoreVertical, LayoutGrid, BrainCircuit, Sparkles, Network, FileText } from "lucide-react";
import { Project, fetchProject, LinkItem, fetchLinks, deleteLink, executeSearch, addLink, updateProject, analyzeText, generateSemanticMap, generateProjectSummary, fetchProjectSummaries, deleteProjectSummary, ProjectSummary, fetchProjectSemanticMaps, deleteProjectSemanticMap, ProjectSemanticMap } from "../lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const getSimplifiedModelName = (modelId?: string): string => {
  if (!modelId) return "";
  const parts = modelId.split("/");
  return parts[parts.length - 1];
};

type Tab = "search" | "links" | "graph" | "summary";

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
  { value: "vi", label: "Vietnamese" },
  { value: "it", label: "Italian" },
  { value: "sq", label: "Albanian" },
  { value: "sh", label: "Bosnian, Croatian & Serbian" }
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
  { value: "AU", label: "Australia" },
  { value: "RU", label: "Russia" }
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

  // Summary generation states
  const [wordCountOption, setWordCountOption] = useState<string>("300");
  const [customWordCount, setCustomWordCount] = useState<string>("300");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState<{ id?: string; heading: string; body: string; wordCountTarget: number; generatedAt: string; rawText?: string } | null>(null);
  const [historicalSummaries, setHistoricalSummaries] = useState<ProjectSummary[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string>("");
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historicalSemanticMaps, setHistoricalSemanticMaps] = useState<ProjectSemanticMap[]>([]);
  const [selectedSemanticMapId, setSelectedSemanticMapId] = useState<string>("");

  // Manual entry state
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [synthesisTimer, setSynthesisTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzingSemantic) {
      setSynthesisTimer(0);
      interval = setInterval(() => {
        setSynthesisTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzingSemantic]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnalyzeSemanticMap = async () => {
    if (!links || links.length === 0) {
      toast({ title: "Intelligence Vault Empty", description: "Add items to the vault before generating a semantic map.", variant: "destructive" });
      return;
    }
    
    setIsAnalyzingSemantic(true);
    // Note: We don't clear old data instantly so the user can still see something while it generates
    try {
      console.log("Starting semantic map generation...");
      const data = await generateSemanticMap(links, project?.query || "General Research", id);
      console.log("Semantic map data received:", data);
      
      if (!data) throw new Error("No data received from engine.");
      
      const newNodes = Array.isArray(data.nodes) ? data.nodes : [];
      const newEdges = Array.isArray(data.edges) ? data.edges : [];
      
      console.log(`Setting semantic data: ${newNodes.length} nodes, ${newEdges.length} edges`);
      
      setSemanticData({
        nodes: newNodes,
        edges: newEdges
      });
      
      // Also update the local project.semantic_map state so that the Active Map description and timestamp are completely in sync
      setProject(prev => prev ? { ...prev, semantic_map: data } : null);

      setActiveTab("graph");

      // Reload historical list so the dropdown shows the newly generated map
      try {
        const maps = await fetchProjectSemanticMaps(id);
        setHistoricalSemanticMaps(maps);
        setSelectedSemanticMapId("latest");
      } catch (mapErr) {
        console.error("Failed to refresh semantic maps list:", mapErr);
      }

      toast({ title: "Map Generated", description: "Semantic relationships extracted successfully." });
    } catch (err: any) {
      console.error("Semantic analysis error:", err);
      
      const isEolError = /422|410|end of life|no longer available/i.test(String(err.message || err)) || 
                         String(err.message || "").includes("valid semantic structure");
      
      toast({ 
        variant: "destructive", 
        title: isEolError ? "Model Outdated" : "Map Generation Failed", 
        description: err.message || "An error occurred during analysis."
      });
    } finally {
      setIsAnalyzingSemantic(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!id || !project) return;
    if (links.length === 0) {
      toast({
        title: "Intelligence Vault Empty",
        description: "Please add some research pieces to your Intelligence Vault first.",
        variant: "destructive",
      });
      return;
    }

    let targetCount = 300;
    if (wordCountOption === "Custom") {
      const parsed = parseInt(customWordCount, 10);
      if (isNaN(parsed) || parsed < 50 || parsed > 1500) {
        toast({
          title: "Invalid Word Count",
          description: "Custom word count must be a number between 50 and 1500 inclusive.",
          variant: "destructive",
        });
        return;
      }
      targetCount = parsed;
    } else {
      targetCount = parseInt(wordCountOption, 10);
    }

    try {
      setIsGeneratingSummary(true);
      const result = await generateProjectSummary(id, links, project.query || project.name, targetCount);
      setSummaryData(result);
      
      // Update local project settings to match what backend saved
      const updatedSettings = {
        ...(project.settings || {}),
        summary: result
      };
      setProject({
        ...project,
        settings: updatedSettings
      });

      // Refetch historical listings
      try {
        const summaries = await fetchProjectSummaries(id);
        setHistoricalSummaries(summaries);
        if (result.id) {
          setSelectedSummaryId(result.id);
        } else if (summaries && summaries.length > 0) {
          setSelectedSummaryId(summaries[0].id);
        }
      } catch (sumErr) {
        console.error("Failed to refresh historical list:", sumErr);
      }

      toast({
        title: "Summary Generated",
        description: `Successfully synthesized a ${targetCount}-word briefing summary.`,
      });
    } catch (err: any) {
      console.error("Summary generation error:", err);
      toast({
        title: "Generation Failed",
        description: err.message || "An unexpected error occurred during summarization.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSelectSummary = (summaryId: string) => {
    setSelectedSummaryId(summaryId);
    if (!summaryId) {
      setSummaryData(null);
      return;
    }
    const found = historicalSummaries.find(s => s.id === summaryId);
    if (found) {
      setSummaryData({
        id: found.id,
        heading: found.heading,
        body: found.body,
        wordCountTarget: found.word_count,
        generatedAt: found.created_at,
        rawText: found.raw_text
      });
    }
  };

  const handleDeleteSummary = async (summaryId: string) => {
    if (!id) return;
    try {
      await deleteProjectSummary(id, summaryId);
      toast({
        title: "Summary Deleted",
        description: "The summary has been removed from history.",
      });
      
      const updatedList = historicalSummaries.filter(s => s.id !== summaryId);
      setHistoricalSummaries(updatedList);
      
      // If we deleted the currently selected summary, shift to the next or null
      if (selectedSummaryId === summaryId) {
        if (updatedList.length > 0) {
          const nextLatest = updatedList[0];
          setSummaryData({
            id: nextLatest.id,
            heading: nextLatest.heading,
            body: nextLatest.body,
            wordCountTarget: nextLatest.word_count,
            generatedAt: nextLatest.created_at,
            rawText: nextLatest.raw_text
          });
          setSelectedSummaryId(nextLatest.id);
        } else {
          setSummaryData(null);
          setSelectedSummaryId("");
        }
      }
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to remove the summary.",
        variant: "destructive"
      });
    }
  };

  const handleSelectSemanticMap = (mapId: string) => {
    setSelectedSemanticMapId(mapId);
    if (!mapId) {
      setSemanticData(null);
      return;
    }
    if (mapId === "latest") {
      if (project?.semantic_map) {
        setSemanticData({
          nodes: Array.isArray(project.semantic_map.nodes) ? project.semantic_map.nodes : [],
          edges: Array.isArray(project.semantic_map.edges) ? project.semantic_map.edges : []
        });
      } else {
        setSemanticData(null);
      }
      return;
    }
    const found = historicalSemanticMaps.find(m => m.id === mapId);
    if (found) {
      setSemanticData({
        nodes: Array.isArray(found.semantic_map.nodes) ? found.semantic_map.nodes : [],
        edges: Array.isArray(found.semantic_map.edges) ? found.semantic_map.edges : []
      });
    }
  };

  const handleDeleteSemanticMap = async (mapId: string) => {
    if (!id) return;
    try {
      if (mapId === "latest") {
        const activeMapId = (project?.semantic_map as any)?.id;
        
        // 1. Clear from projects table
        await updateProject(id, { semantic_map: {} });
        setProject(prev => prev ? { ...prev, semantic_map: {} } : null);
        setSemanticData(null);
        setSelectedSemanticMapId("");

        // 2. Also delete from history if there was an associated ID
        if (activeMapId) {
          try {
            await deleteProjectSemanticMap(id, activeMapId);
            setHistoricalSemanticMaps(prev => prev.filter(m => m.id !== activeMapId));
          } catch (historyErr) {
            console.warn("Failed to delete matching active map from history table:", historyErr);
          }
        }

        toast({
          title: "Active Map Cleared",
          description: "The active semantic map has been cleared and purged from history.",
        });
        return;
      }

      // If we are deleting a historical map specifically
      await deleteProjectSemanticMap(id, mapId);
      
      // If the historical map we are deleting is currently cached as the active map, clear it too!
      const activeMapId = (project?.semantic_map as any)?.id;
      if (activeMapId === mapId) {
        await updateProject(id, { semantic_map: {} });
        setProject(prev => prev ? { ...prev, semantic_map: {} } : null);
      }

      toast({
        title: "Semantic Map Deleted",
        description: "The semantic map has been removed from history and live cache.",
      });
      
      const updatedList = historicalSemanticMaps.filter(m => m.id !== mapId);
      setHistoricalSemanticMaps(updatedList);
      
      // If we deleted the currently selected semantic map, shift to the next or null
      if (selectedSemanticMapId === mapId) {
        if (updatedList.length > 0) {
          const nextLatest = updatedList[0];
          setSemanticData({
            nodes: Array.isArray(nextLatest.semantic_map.nodes) ? nextLatest.semantic_map.nodes : [],
            edges: Array.isArray(nextLatest.semantic_map.edges) ? nextLatest.semantic_map.edges : []
          });
          setSelectedSemanticMapId(nextLatest.id);
        } else {
          setSemanticData(null);
          setSelectedSemanticMapId("");
        }
      }
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to remove the semantic map.",
        variant: "destructive"
      });
    }
  };

  const handleAnalyzeResult = async (result: any) => {
    setAnalyzingResults(prev => ({ ...prev, [result.url]: { loading: true, text: "" } }));
    try {
      const { analysis } = await analyzeText(result.snippet || result.title, searchQuery);
      setAnalyzingResults(prev => ({ ...prev, [result.url]: { loading: false, text: analysis } }));
    } catch (err: any) {
      const isEolError = /422|410|end of life|no longer available/i.test(String(err.message || err)) || 
                         String(err.message || "").includes("valid semantic structure");

      toast({ 
        variant: "destructive", 
        title: isEolError ? "Model Outdated" : "Analysis Failed", 
        description: err.message || "An error occurred during analysis."
      });
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
    "pl": "Polish", "nl": "Dutch", "id": "Indonesian",
    "sq": "Albanian", "sh": "Bosnian, Croatian & Serbian"
  };

  const regionNameMap: Record<string, string> = {
    "Global": "Global", "US": "USA", "GB": "UK", "IN": "India", "CA": "Canada", 
    "AU": "Australia", "IL": "Israel", "PK": "Pakistan", "FR": "France",
    "DE": "Germany", "CN": "China", "JP": "Japan", "BR": "Brazil", "RU": "Russia"
  };

  useEffect(() => {
    if (id) {
      setHasInitialSearched(false);
      setAllSearchResults([]);
      setSearchQuery("");
      setSearchError(null);
      setProject(null);
      setSemanticData(null);
      setIsAnalyzingSemantic(false); // Reset loading state when switching projects
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
      
      // Load historical semantic maps
      try {
        const maps = await fetchProjectSemanticMaps(id);
        setHistoricalSemanticMaps(maps);
        if (pData.semantic_map && typeof pData.semantic_map === 'object' && Object.keys(pData.semantic_map).length > 0) {
          setSemanticData({
            nodes: Array.isArray(pData.semantic_map.nodes) ? pData.semantic_map.nodes : [],
            edges: Array.isArray(pData.semantic_map.edges) ? pData.semantic_map.edges : []
          });
          setSelectedSemanticMapId("latest");
        } else if (maps && maps.length > 0) {
          const latestMap = maps[0];
          setSemanticData({
            nodes: Array.isArray(latestMap.semantic_map.nodes) ? latestMap.semantic_map.nodes : [],
            edges: Array.isArray(latestMap.semantic_map.edges) ? latestMap.semantic_map.edges : []
          });
          setSelectedSemanticMapId(latestMap.id);
        } else {
          setSemanticData(null);
          setSelectedSemanticMapId("");
        }
      } catch (mapErr) {
        console.error("Failed to load historical semantic maps:", mapErr);
        // Fallback to loaded semantic map if it exists
        if (pData.semantic_map && typeof pData.semantic_map === 'object' && Object.keys(pData.semantic_map).length > 0) {
          setSemanticData({
            nodes: Array.isArray(pData.semantic_map.nodes) ? pData.semantic_map.nodes : [],
            edges: Array.isArray(pData.semantic_map.edges) ? pData.semantic_map.edges : []
          });
          setSelectedSemanticMapId("latest");
        } else {
          setSemanticData(null);
          setSelectedSemanticMapId("");
        }
      }

      // Load historical summaries
      try {
        const summaries = await fetchProjectSummaries(id);
        setHistoricalSummaries(summaries);
        if (summaries && summaries.length > 0) {
          const latest = summaries[0];
          setSummaryData({
            id: latest.id,
            heading: latest.heading,
            body: latest.body,
            wordCountTarget: latest.word_count,
            generatedAt: latest.created_at,
            rawText: latest.raw_text
          });
          setSelectedSummaryId(latest.id);
        } else {
          // Fallback to loadedSummary from settings if any, otherwise null
          const loadedSummary = pData.settings?.summary || null;
          if (loadedSummary) {
            setSummaryData(loadedSummary);
            setSelectedSummaryId(loadedSummary.id || "latest");
          } else {
            setSummaryData(null);
            setSelectedSummaryId("");
          }
        }
      } catch (sumErr) {
        console.error("Failed to load historical summaries:", sumErr);
        // Fallback to loadedSummary from settings if any, otherwise null
        const loadedSummary = pData.settings?.summary || null;
        if (loadedSummary) {
          setSummaryData(loadedSummary);
          setSelectedSummaryId(loadedSummary.id || "latest");
        } else {
          setSummaryData(null);
          setSelectedSummaryId("");
        }
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

  async function handleManualEntry() {
    if (!id) return;
    if (!manualUrl) {
      toast({ title: "Verification Error", description: "Please enter a valid URL.", variant: "destructive" });
      return;
    }

    // Basic URL validation
    try {
      new URL(manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`);
    } catch (e) {
      toast({ title: "Invalid URL", description: "The provided link is not a valid URL structure.", variant: "destructive" });
      return;
    }

    const formattedUrl = manualUrl.startsWith('http') ? manualUrl : `https://${manualUrl}`;

    setIsVerifyingLink(true);
    try {
      // Step 1: Search for the URL on the web to "verify and get metadata"
      const results = await executeSearch(formattedUrl, {
        sources: ["Web Search"],
        regions: ["Global"],
        languages: ["en"]
      });

      // Step 2: Try to find a good result. If search results exist, use info from them.
      // If not, we still allow adding it as the user provided a valid URL.
      const foundResult = results.find(r => r.url.includes(formattedUrl) || formattedUrl.includes(r.url)) || results[0];

      if (foundResult) {
        await handleAddLink(foundResult);
      } else {
        await handleAddLink({
          url: formattedUrl,
          title: "Manual Reference",
          snippet: "This source was added manually via the Intelligence Vault interface.",
          source: "Manual Entry"
        });
      }
      
      setManualUrl("");
      setIsManualEntryOpen(false);
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsVerifyingLink(false);
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
                className="pl-11 h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/10 focus:border-primary transition-all"
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
              <MultiSelect className="h-9 min-w-32 max-w-[150px] bg-slate-50 text-[10px] uppercase font-bold" options={ALL_REGIONS} selected={regions} onChange={setRegions} placeholder="Regions" enableSelectClearAll={true} />
              <MultiSelect className="h-9 min-w-32 max-w-[180px] bg-slate-50 text-[10px] uppercase font-bold" options={ALL_LANGUAGES} selected={languages} onChange={setLanguages} placeholder="Languages" enableSelectClearAll={true} />
              <MultiSelect className="h-9 min-w-32 max-w-[150px] bg-slate-50 text-[10px] uppercase font-bold" options={sourceOptions} selected={sources} onChange={setSources} placeholder="Sources" />
            </div>
            
            <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1" />

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100 group transition-all">
              <List className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
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
              <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-lg border border-primary/20 animate-in fade-in zoom-in duration-300">
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
                <Card className="border-slate-200 shadow-sm hover:border-primary/30 transition-all group overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-primary transition-colors" />
                  <div className="absolute top-4 left-6 flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 text-[10px] font-black text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all border border-slate-100">
                    {idx + 1}
                  </div>
                  
                  <CardHeader className="p-6 pb-0 pl-16">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none">
                          {result.source}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-slate-200">
                          Language: {result.language?.toUpperCase()}
                        </Badge>
                        {result.region && (
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-slate-200">
                            Region: {result.region?.toUpperCase()}
                          </Badge>
                        )}
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
                    <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors leading-snug">
                      {result.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">
                      {result.snippet}
                    </p>
 
                    {analyzingResults[result.url] && (
                      <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">IA Intelligence Synthesis</span>
                        </div>
                        {analyzingResults[result.url].loading ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-3 h-3 text-primary/40 animate-spin" />
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
                          className="h-8 text-[10px] font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 shadow-md shadow-primary/10"
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
        
        <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 text-[10px] font-bold uppercase tracking-wider">
              <Plus className="w-3.5 h-3.5" /> Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] p-0 overflow-hidden border-8 border-slate-50 shadow-2xl">
            <DialogHeader className="p-8 pb-4 bg-slate-50/50">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-inner">
                <Globe className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Direct Intelligence Import</DialogTitle>
              <DialogDescription className="text-slate-500 font-medium">
                Paste a verified URL to ingest it into your project vault. We'll synchronize metadata automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="p-8 pt-4 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Source URL</label>
                <Input 
                  placeholder="https://example.com/insight-report" 
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="h-14 bg-slate-50 border-slate-200 rounded-2xl focus:ring-primary/20 text-sm font-medium"
                />
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsManualEntryOpen(false)}
                  className="flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleManualEntry}
                  disabled={isVerifyingLink || !manualUrl}
                  className="flex-[2] h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 transition-all active:scale-[0.98] gap-3"
                >
                  {isVerifyingLink ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  {isVerifyingLink ? "Verifying..." : "Verify & Import"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {links.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-100">
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
              className="px-8 h-12 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 gap-2 min-w-[200px]"
            >
              {isAnalyzingSemantic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isAnalyzingSemantic ? "Synthesizing..." : "Analyze Results"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2nd row: Historic semantic map list dropdown */}
      {((historicalSemanticMaps && historicalSemanticMaps.length > 0) || 
        (project?.semantic_map && typeof project.semantic_map === 'object' && Object.keys(project.semantic_map).length > 0)) && (() => {
          const uniqueHistoricalMaps = historicalSemanticMaps.filter(
            (map) => !project?.semantic_map || (project.semantic_map as any).id !== map.id
          );
          const totalDocs = uniqueHistoricalMaps.length + (project?.semantic_map && Object.keys(project.semantic_map).length > 0 ? 1 : 0);
          return (
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                    <div className="flex flex-col gap-1.5 w-full">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Select Semantic Map From History ({totalDocs})
                      </span>
                      <select
                        value={selectedSemanticMapId}
                        onChange={(e) => handleSelectSemanticMap(e.target.value)}
                        className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/10 cursor-pointer w-full shadow-sm transition-all"
                      >
                        {project?.semantic_map && typeof project.semantic_map === 'object' && Object.keys(project.semantic_map).length > 0 && (
                          <option value="latest">
                            [Active Map] Current Live Semantic Map ({Array.isArray((project.semantic_map as any).nodes) ? (project.semantic_map as any).nodes.length : 0} nodes){(project?.semantic_map as any)?.model_id ? ` • ${getSimplifiedModelName((project.semantic_map as any).model_id)}` : ""} - {((project.semantic_map as any).created_at ? new Date((project.semantic_map as any).created_at) : new Date(project.created_at)).toLocaleString()}
                          </option>
                        )}
                        {uniqueHistoricalMaps.map((map) => {
                          const nCount = map.nodes_count || (Array.isArray(map.semantic_map?.nodes) ? map.semantic_map.nodes.length : 0);
                          const eCount = map.edges_count || (Array.isArray(map.semantic_map?.edges) ? map.semantic_map.edges.length : 0);
                          const mId = map.model_id || map.semantic_map?.model_id;
                          const modelStr = mId ? ` • ${getSimplifiedModelName(mId)}` : "";
                          return (
                            <option key={map.id} value={map.id}>
                              Historic Map ({nCount} nodes, {eCount} edges){modelStr} - {new Date(map.created_at).toLocaleString()}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {selectedSemanticMapId && (
                    <Button
                      onClick={() => handleDeleteSemanticMap(selectedSemanticMapId)}
                      variant="outline"
                      className="h-10 px-6 text-red-500 hover:text-red-600 hover:bg-red-50/50 border-red-100 rounded-xl text-xs font-bold uppercase tracking-widest gap-2 transition-all md:self-end"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete This Record
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

      {isAnalyzingSemantic ? (
        <div className="py-32 flex flex-col items-center gap-6 text-center">
          <div className="relative">
            <div className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center border-8 border-primary/5 shadow-inner">
              <BrainCircuit className="w-12 h-12 text-primary" />
              <div className="mt-1 font-mono text-[10px] font-black text-primary/60 tabular-nums uppercase tracking-widest">
                {formatTime(synthesisTimer)}
              </div>
            </div>
            <div className="absolute -inset-6 border-2 border-primary/20 rounded-full animate-[spin_8s_linear_infinite]" />
            <div className="absolute -inset-2 border-b-2 border-primary rounded-full animate-[spin_3s_ease-in-out_infinite]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-slate-900">Neural Network Synthesis</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Extracting entities and mapping high-dimensional relationship vectors from project intelligence...
            </p>
          </div>
        </div>
      ) : (semanticData && semanticData.nodes && semanticData.nodes.length > 0) ? (
        <div className="space-y-12">
          {/* Insights Grid */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-primary/10 text-primary font-bold tracking-widest uppercase">Intelligence Clusters</Badge>
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
                  <Card className="border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden border-t-2 border-t-primary/40 h-full">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{node.type || 'Entity'}</span>
                        <Network className="w-4 h-4 text-slate-200 group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors leading-tight">
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
                                <Activity className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <span className="font-bold text-primary uppercase tracking-tighter leading-none">{edge.relation || 'LINKED TO'}</span>
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
                    <div className="w-2 h-2 rounded-full bg-primary" />
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

  const renderSummaryTab = () => (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500 w-full min-w-0 max-w-full">
      {/* Top row with Word Count field & Generate Summary button */}
      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm w-full min-w-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Word Count Target</span>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={wordCountOption}
                    onChange={(e) => setWordCountOption(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/10 cursor-pointer min-w-[150px] shadow-sm transition-all"
                  >
                    <option value="100">100 Words</option>
                    <option value="200">200 Words</option>
                    <option value="300">300 Words</option>
                    <option value="400">400 Words</option>
                    <option value="500">500 Words</option>
                    <option value="Custom">Custom</option>
                  </select>

                  {wordCountOption === "Custom" && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                      <Input
                        type="number"
                        value={customWordCount}
                        onChange={(e) => setCustomWordCount(e.target.value)}
                        placeholder="50-1500"
                        min={50}
                        max={1500}
                        className="h-10 w-32 border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-700 bg-white shadow-sm focus-visible:ring-primary/10"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button 
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary || links.length === 0}
              className="px-8 h-12 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/10 gap-2 min-w-[200px] shrink-0"
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2nd row: Historic records selection dropdown */}
      {historicalSummaries.length > 0 && (
        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300 w-full min-w-0">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-1.5 w-full min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Select Compiled Briefing From History ({historicalSummaries.length})
                  </span>
                  <select
                    value={selectedSummaryId}
                    onChange={(e) => handleSelectSummary(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/10 cursor-pointer w-full shadow-sm transition-all truncate"
                  >
                    {historicalSummaries.map((sum) => {
                      const mName = sum.model_id ? getSimplifiedModelName(sum.model_id) : "";
                      const modelStr = mName ? ` • ${mName}` : "";
                      return (
                        <option key={sum.id} value={sum.id}>
                          [{new Date(sum.created_at).toLocaleString()}{modelStr}] {sum.heading.slice(0, 80)}{sum.heading.length > 80 ? "..." : ""} ({sum.word_count} words)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {selectedSummaryId && (
                <Button
                  onClick={() => handleDeleteSummary(selectedSummaryId)}
                  variant="outline"
                  className="h-10 px-6 text-red-500 hover:text-red-600 hover:bg-red-50/50 border-red-100 rounded-xl text-xs font-bold uppercase tracking-widest gap-2 transition-all sm:self-end shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete This Record
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary output content block */}
      {isGeneratingSummary ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm w-full">
          <div className="relative mb-6">
            <Activity className="w-12 h-12 text-blue-500 animate-pulse" />
            <BrainCircuit className="w-6 h-6 text-primary absolute inset-0 m-auto animate-spin" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Synthesizing Briefing Package</h3>
          <p className="text-sm text-slate-400 max-w-sm text-center">
            Analyzing and structuring {links.length} intelligence items into a custom cohesive report...
          </p>
        </div>
      ) : summaryData ? (
        <Card className="rounded-3xl border-slate-200 shadow-xl overflow-hidden bg-white w-full min-w-0 max-w-full">
          <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
              <Badge variant="secondary" className="bg-primary/5 text-primary font-bold tracking-widest uppercase text-[10px] px-3 py-1">
                EXECUTIVE INTELLIGENCE BRIEFING
              </Badge>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Generated {new Date(summaryData.generatedAt).toLocaleString()} • Target: {summaryData.wordCountTarget} words
              </span>
            </div>
            <CardTitle className="text-3xl font-black text-slate-900 tracking-tight leading-tight mt-3 break-words">
              {summaryData.heading}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-8 md:p-12 space-y-6 text-slate-700 text-sm md:text-base leading-relaxed font-sans max-w-full prose prose-slate break-words min-w-0">
            {summaryData.body.split('\n\n').map((paragraph, index) => {
              if (!paragraph.trim()) return null;
              
              return (
                <p key={index} className="whitespace-pre-wrap break-all sm:break-words [word-break:break-word] max-w-full">
                  {paragraph.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={pIdx} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </p>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <div className="py-32 flex flex-col items-center text-center bg-white rounded-3xl border border-dashed border-slate-200 w-full">
          <div className="w-20 h-20 bg-white border border-dashed border-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <FileText className="w-8 h-8 text-slate-300 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Executive Summarization</h3>
          <p className="text-sm text-slate-400 max-w-md mb-8">
            Synthesize {links.length} items from your Intelligence Vault into an executive report customized to your choice of length.
          </p>
          <Button 
            onClick={handleGenerateSummary}
            disabled={links.length === 0 || isGeneratingSummary}
            variant="outline"
            className="h-11 px-8 rounded-xl border-2 border-slate-200 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-all gap-2"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            Analyze Vault Content
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
        <Tabs value={activeTab} className="flex flex-col h-full" onValueChange={(val) => setActiveTab(val as Tab)}>
          <div className="px-8 bg-white border-b border-slate-200 shrink-0">
            <TabsList className="justify-start h-auto p-0 bg-transparent gap-8">
              <TabsTrigger 
                value="search" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Search className="w-3.5 h-3.5" />
                Search Engine
              </TabsTrigger>
              <TabsTrigger 
                value="links" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Intelligence Vault ({links.length})
              </TabsTrigger>
              <TabsTrigger 
                value="graph" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <Share2 className="w-3.5 h-3.5" />
                Semantic Map
              </TabsTrigger>
              <TabsTrigger 
                value="summary" 
                className="py-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none text-xs font-bold uppercase tracking-widest gap-2"
              >
                <FileText className="w-3.5 h-3.5" />
                Summary
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <ScrollArea className="h-full">
              <div className="p-8 max-w-[95%] mx-auto min-h-full transition-all duration-500">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-[1px] z-10">
                    <div className="flex flex-col items-center gap-4">
                      <Activity className="w-10 h-10 text-primary/40 animate-spin" />
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
                    <TabsContent value="summary" className="m-0 mt-0 focus-visible:ring-0">
                      {renderSummaryTab()}
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
