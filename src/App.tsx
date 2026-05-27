import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Layout, Settings2, Loader2, Wand2, LogOut, Calendar as CalendarIcon, CheckCircle2, Clock, Info, ChevronRight, Bell, Plus, Trash2, Key, HelpCircle, X, Activity, Users, Share2, BookOpen } from "lucide-react";
import { generateSocialPosts, GeneratedPost, getCelebrations, setGeminiApiKeys, getApiKeysStatus, ApiKeyStatus, generatePostImage, generateSingleSocialPost, ApiKeyConfig } from "./services/gemini";
import Markdown from "react-markdown";
import { PostCard } from "./components/PostCard";
import { CalendarView } from "./components/CalendarView";
import { Login } from "./components/Login";
import { AdminDashboard } from "./components/AdminDashboard";
import { AdminUsers } from "./components/AdminUsers";
import { HelpModal } from "./components/HelpModal";
import { motion, AnimatePresence } from "motion/react";
import { format, addDays, isBefore, isSameDay, parseISO } from "date-fns";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  setDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  limit
} from "firebase/firestore";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getApiUrl } from "./lib/config";

const TONES = ["Professional", "Casual", "Witty", "Inspirational", "Educational", "Urgent"];
const PLATFORMS = ["Twitter", "LinkedIn", "Instagram", "Facebook", "Threads"];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Activity className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-8 leading-relaxed">
              We've encountered an unexpected error. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
            >
              Refresh Page
            </button>
            <div className="mt-8 pt-8 border-t border-slate-100 text-left">
              <p className="text-[10px] font-mono text-slate-400 overflow-auto max-h-32">
                {this.state.error?.toString()}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [idea, setIdea] = useState("");
  const [tone, setTone] = useState("Professional");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Twitter", "LinkedIn"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [celebrations, setCelebrations] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"generate" | "calendar" | "settings" | "admin-dashboard" | "admin-users">("generate");
  const [isFetchingCelebrations, setIsFetchingCelebrations] = useState(false);
  const [brandGuidelines, setBrandGuidelines] = useState("");
  const [brandLogoDark, setBrandLogoDark] = useState<string | null>(null);
  const [brandLogoLight, setBrandLogoLight] = useState<string | null>(null);
  const [brandWebsite, setBrandWebsite] = useState("");
  const [imageStyle, setImageStyle] = useState("Photorealistic");
  const [geminiApiKeys, setGeminiApiKeysState] = useState<ApiKeyConfig[]>(() => {
    // Load from localStorage as initial state for faster startup
    const cached = localStorage.getItem("gemini_api_keys");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Migration: strings to objects
        const migrated = (parsed as any[]).map(k => typeof k === 'string' ? { key: k, shared: false } : k);
        setGeminiApiKeys(migrated);
        return migrated;
      } catch (e) {
        console.error("Failed to parse cached API keys:", e);
      }
    }
    return [];
  });
  const [sharedUsageCount, setSharedUsageCount] = useState(0);
  const [platformConnections, setPlatformConnections] = useState<Record<string, boolean>>({
    Twitter: false,
    LinkedIn: false,
    Instagram: false,
    Facebook: false,
    Threads: false
  });
  const [showCelebrations, setShowCelebrations] = useState(false);
  const [celebrationFilter, setCelebrationFilter] = useState("All");
  const [showConnectGuide, setShowConnectGuide] = useState(false);
  const [visibleCelebrationsCount, setVisibleCelebrationsCount] = useState(5);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [globalPixazoApiKey, setGlobalPixazoApiKey] = useState("");
  const [userPixazoApiKey, setUserPixazoApiKey] = useState("");
  const [isSavingPixazo, setIsSavingPixazo] = useState(false);
  const [activeHelpPlatform, setActiveHelpPlatform] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<any | null>(null);

  // Use refs for settings to avoid stale closures in handleMessage
  const settingsRef = useRef({
    brandGuidelines,
    brandLogoDark,
    brandLogoLight,
    brandWebsite,
    imageStyle,
    platformConnections,
    geminiApiKeys,
    showCelebrations,
    celebrationFilter
  });

  useEffect(() => {
    settingsRef.current = {
      brandGuidelines,
      brandLogoDark,
      brandLogoLight,
      brandWebsite,
      imageStyle,
      platformConnections,
      geminiApiKeys,
      showCelebrations,
      celebrationFilter
    };
  }, [brandGuidelines, brandLogoDark, brandLogoLight, brandWebsite, imageStyle, platformConnections, geminiApiKeys, showCelebrations, celebrationFilter]);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: "info" | "warning" | "success" | "error" }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ApiKeyStatus[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setApiKeyStatuses(getApiKeysStatus());
    }, 1000);
    setApiKeyStatuses(getApiKeysStatus());
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch user settings
    const fetchSettings = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBrandGuidelines(data.brandGuidelines || "");
          setBrandLogoDark(data.brandLogoDark || null);
          setBrandLogoLight(data.brandLogoLight || null);
          setBrandWebsite(data.brandWebsite || "");
          setImageStyle(data.imageStyle || "Photorealistic");
          setSharedUsageCount(data.sharedUsageCount || 0);
          
          const rawKeys = data.geminiApiKeys || [];
          const dbKeys: ApiKeyConfig[] = rawKeys.map((k: any) => typeof k === 'string' ? { key: k, shared: false } : k);
          
          // Merge with current state (which might have localStorage keys)
          setGeminiApiKeysState(prev => {
            const combinedMap = new Map<string, ApiKeyConfig>();
            [...prev, ...dbKeys].forEach(k => combinedMap.set(k.key, k));
            const combined = Array.from(combinedMap.values());
            
            // Auto-detect and save platform API_KEY if present
            const platformApiKey = process.env.API_KEY;
            if (platformApiKey && !combined.find(k => k.key === platformApiKey)) {
              combined.unshift({ key: platformApiKey, shared: false });
              // Trigger an auto-save
              saveSettings({
                ...data,
                geminiApiKeys: combined
              });
            }
            
            setGeminiApiKeys(combined);
            localStorage.setItem("gemini_api_keys", JSON.stringify(combined));
            return combined;
          });

          setPlatformConnections(data.platformConnections || {
            Twitter: false,
            LinkedIn: false,
            Instagram: false,
            Facebook: false,
            Threads: false
          });
          setShowCelebrations(data.showCelebrations ?? false);
          setCelebrationFilter(data.celebrationFilter || "All");
          setUserPixazoApiKey(data.pixazoApiKey || "");
        } else {
          // Initialize user document if it doesn't exist
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            createdAt: serverTimestamp()
          });
        }

        // Fetch global Pixazo API key
        const pixazoDoc = await getDoc(doc(db, "system_config", "image_generation"));
        if (pixazoDoc.exists()) {
          setGlobalPixazoApiKey(pixazoDoc.data().pixazoApiKey || "");
        }
      } catch (error: any) {
        console.error("Failed to fetch settings:", error);
        // If it's a permission error, it might be because the document doesn't exist yet 
        // or the database is still initializing. 
        if (error.code === 'permission-denied') {
          console.warn("Permission denied for user settings. Retrying might be needed if the database was just provisioned.");
        }
      }
    };
    fetchSettings();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Use onSnapshot for real-time posts
    const q = query(
      collection(db, "posts"), 
      where("userId", "==", user.uid),
      orderBy("scheduledAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScheduledPosts(postsData);
    }, (error) => {
      console.error("Failed to fetch posts:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // In this environment, messages can come from multiple origins (cloud run, aistudio, etc.)
      // We check for the specific message type and platform
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { platform } = event.data;
        if (platform) {
          setPlatformConnections(prev => {
            const newConnections = { ...prev, [platform]: true };
            // Auto-save when platform is connected using ref values
            if (user) {
              saveSettings({
                ...settingsRef.current,
                platformConnections: newConnections
              });
            }
            return newConnections;
          });
          setConnectingPlatform(null);
          
          // Add notification
          setNotifications(prev => [
            { id: Math.random().toString(), message: `Successfully connected to ${platform}! Settings updated.`, type: "info" },
            ...prev
          ]);
          setShowNotifications(true);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // Notification system: Check for posts due in 1 day
  useEffect(() => {
    if (!user || scheduledPosts.length === 0) return;

    const checkDuePosts = () => {
      const tomorrow = addDays(new Date(), 1);
      const duePosts = scheduledPosts.filter(p => 
        p.status === "scheduled" && 
        isBefore(new Date(p.scheduledAt), tomorrow) &&
        !p.notified
      );

      if (duePosts.length > 0) {
        const newNotifications = duePosts.map(p => ({
          id: p.id,
          message: `Action Required: Post for ${p.platform} is due in less than 24 hours. Please review and approve it for publishing!`,
          type: "warning" as const
        }));

        setNotifications(prev => {
          // Avoid duplicates by checking message
          const existingMessages = new Set(prev.map(n => n.message));
          const filteredNew = newNotifications.filter(n => !existingMessages.has(n.message));
          return [...filteredNew, ...prev];
        });

        // Mark as notified in Firestore to avoid duplicate notifications
        duePosts.forEach(async (p) => {
          try {
            await updateDoc(doc(db, "posts", p.id), { notified: true });
          } catch (e) {
            console.error("Failed to mark post as notified:", e);
          }
        });

        // Browser notification if permitted
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("ImaGenie: Approval Required", {
            body: `You have ${duePosts.length} post(s) that need approval before tomorrow's deadline.`,
            icon: "/favicon.ico"
          });
        } else if ("Notification" in window && Notification.permission !== "denied") {
          Notification.requestPermission();
        }
      }
    };

    checkDuePosts();
    const interval = setInterval(checkDuePosts, 3600000); // Check every hour
    return () => clearInterval(interval);
  }, [user, scheduledPosts]);

  // Auto-publish logic
  useEffect(() => {
    if (!user || scheduledPosts.length === 0) return;

    const checkAndPublish = async () => {
      const now = new Date();
      for (const post of scheduledPosts) {
        // Publish if status is "approved" and scheduled time has passed
        if (post.status === "approved" && isBefore(new Date(post.scheduledAt), now)) {
          const isConnected = platformConnections[post.platform];
          if (isConnected) {
            try {
              // Real publish call to backend
              const idToken = await user.getIdToken();
              const response = await fetch(getApiUrl("/api/publish"), {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({
                  platform: post.platform,
                  content: post.content,
                  hashtags: post.hashtags,
                  userId: user.uid,
                  postId: post.id // Pass postId to update status and clear imageData
                })
              });

              if (response.ok) {
                setNotifications(prev => [
                  { id: Math.random().toString(), message: `Successfully published post to ${post.platform}!`, type: "info" },
                  ...prev
                ]);
              }
            } catch (error) {
              console.error(`Failed to auto-publish post ${post.id}:`, error);
            }
          }
        }
      }
    };

    const interval = setInterval(checkAndPublish, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user, scheduledPosts, platformConnections]);

  // Automation for Indian Celebrations
  useEffect(() => {
    if (!user || celebrations.length === 0 || scheduledPosts.length === 0) return;

    const automateCelebrations = async () => {
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

      for (const celebration of celebrations) {
        // Check if celebration date matches tomorrow
        if (celebration.date === tomorrowStr) {
          // Check if post already exists for this celebration
          const alreadyScheduled = scheduledPosts.some(p => 
            p.idea === `Celebration: ${celebration.name}` && 
            isSameDay(new Date(p.scheduledAt), tomorrow)
          );

          if (!alreadyScheduled) {
            console.log(`Automating post for ${celebration.name}...`);
            try {
              const idea = `Celebration: ${celebration.name}`;
              const posts = await generateSocialPosts(
                `Create a celebratory post for ${celebration.name}. ${celebration.description}`,
                "Inspirational",
                selectedPlatforms,
                brandGuidelines,
                brandWebsite
              );

              for (const post of posts) {
                // Generate image for each post
                const effectivePixazoApiKey = userPixazoApiKey || globalPixazoApiKey;
                const imageData = await generatePostImage(
                  post.content,
                  brandGuidelines,
                  brandLogoDark || undefined,
                  brandLogoLight || undefined,
                  brandWebsite,
                  imageStyle,
                  "Single",
                  1,
                  effectivePixazoApiKey
                );

                // Schedule automatically as "approved"
                await addDoc(collection(db, "posts"), {
                  userId: user.uid,
                  idea,
                  platform: post.platform,
                  content: post.content,
                  hashtags: post.suggestedHashtags,
                  status: "approved", // Auto-approved
                  scheduledAt: new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString(), // 9 AM tomorrow
                  imageData,
                  createdAt: serverTimestamp()
                });
              }
              fetchCelebrations();
              setNotifications(prev => [
                { id: Math.random().toString(), message: `Auto-scheduled posts for ${celebration.name}!`, type: "info" },
                ...prev
              ]);
            } catch (error) {
              console.error(`Failed to automate post for ${celebration.name}:`, error);
            }
          }
        }
      }
    };

    automateCelebrations();
  }, [user, celebrations, scheduledPosts, selectedPlatforms, brandGuidelines, brandLogoDark, brandLogoLight, brandWebsite, imageStyle]);

  useEffect(() => {
    if (user && showCelebrations && celebrations.length === 0) {
      fetchCelebrations();
    }
  }, [user, showCelebrations]);

  useEffect(() => {
    if (showCelebrations) {
      setVisibleCelebrationsCount(5);
    }
  }, [showCelebrations]);

  const fetchCelebrations = async () => {
    setIsFetchingCelebrations(true);
    try {
      const results = await getCelebrations();
      setCelebrations(results);
    } catch (error: any) {
      console.error("Failed to fetch celebrations:", error);
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Could not load upcoming celebrations: ${error.message || "API error"}. Check your API keys.`, type: "warning" },
        ...prev
      ]);
    } finally {
      setIsFetchingCelebrations(false);
    }
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setNotifications(prev => [
        { id: Math.random().toString(), message: "Please enter an idea before generating.", type: "warning" },
        ...prev
      ]);
      setShowNotifications(true);
      return;
    }

    if (selectedPlatforms.length === 0) {
      setNotifications(prev => [
        { id: Math.random().toString(), message: "Please select at least one social media platform.", type: "warning" },
        ...prev
      ]);
      setShowNotifications(true);
      return;
    }

    setIsGenerating(true);
    let usingSharedKey = false;

    try {
      // Check if user has their own keys
      const userKeys = geminiApiKeys.filter(k => k.key.trim() !== "");
      
      if (userKeys.length === 0) {
        // User has no keys, try to use shared ones if any
        const sharedKeysQuery = query(collection(db, "shared_api_keys"), limit(10));
        const sharedKeysSnap = await getDocs(sharedKeysQuery);
        const fetchedSharedKeys = sharedKeysSnap.docs.map(doc => doc.data().key);

        if (fetchedSharedKeys.length > 0) {
          if (sharedUsageCount >= 2) {
            const errorMsg = "Shared Key Limit Reached: You have already used 2 content generations with shared API keys. To continue, please add your own free Gemini API key in Settings > Gemini API Keys. You can follow the tutorial there to get one in seconds!";
            throw new Error(errorMsg);
          }
          // Temporarily use shared keys
          setGeminiApiKeys(fetchedSharedKeys.map(k => ({ key: k, shared: true })));
          usingSharedKey = true;
        }
        // If still no keys, we'll proceed and hope generateSocialPosts can use platform defaults
      }

      const results = await generateSocialPosts(idea, tone, selectedPlatforms, brandGuidelines, brandWebsite);
      setGeneratedPosts(results);

      // Successfully generated
      if (usingSharedKey && user) {
        const newCount = sharedUsageCount + 1;
        setSharedUsageCount(newCount);
        await updateDoc(doc(db, "users", user.uid), {
          sharedUsageCount: newCount
        });
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      setNotifications(prev => [
        { id: Math.random().toString(), message: error.message.includes("Shared Key Limit") ? error.message : `Gemini API Error: ${error.message || "An unexpected error occurred."} Please verify your API keys in Settings and try again.`, type: "warning" },
        ...prev
      ]);
      setShowNotifications(true);
    } finally {
      setIsGenerating(false);
      // Restore user's own keys (which was empty) or platform keys
      if (usingSharedKey) {
        setGeminiApiKeys(geminiApiKeys);
      }
    }
  };

  const handleSchedule = async (post: GeneratedPost, date: string, status: string = "scheduled") => {
    if (!user) {
      setNotifications(prev => [
        { id: Math.random().toString(), message: "Sign in to save and schedule your posts!", type: "info" },
        ...prev
      ]);
      setShowNotifications(true);
      return;
    }
    try {
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Scheduling for ${post.platform}...`, type: "info" },
        ...prev
      ]);

      const postData = {
        userId: user.uid,
        idea: idea || "Manual Post",
        platform: post.platform,
        content: post.content,
        hashtags: post.suggestedHashtags,
        status: status,
        scheduledAt: date,
        imageData: post.imageData,
        imageStyle: post.imageStyle,
        imageType: post.imageType,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "posts"), postData);
      
      setGeneratedPosts(prev => prev.filter(p => p !== post));
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Successfully scheduled for ${post.platform}!`, type: "info" },
        ...prev
      ]);
      setShowNotifications(true);
    } catch (error: any) {
      console.error("Failed to schedule post:", error);
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Failed to schedule: ${error.message || "Database error"}`, type: "error" },
        ...prev
      ]);
      setShowNotifications(true);
    }
  };

  const handleUpdatePost = async (updatedPost: GeneratedPost) => {
    if (!updatedPost.id) {
      // If it's a draft (not yet in DB), just update the local state
      setGeneratedPosts(prev => prev.map(p => p.platform === updatedPost.platform && p.content === updatedPost.content ? updatedPost : p));
      return;
    }

    try {
      const { id, ...postToUpdate } = updatedPost as any;
      await updateDoc(doc(db, "posts", id), postToUpdate);

      setNotifications(prev => [
        { id: Math.random().toString(), message: "Post updated successfully!", type: "success" },
        ...prev
      ]);
    } catch (error) {
      console.error("Failed to update post:", error);
    }
  };

  const handleRegeneratePost = async (post: GeneratedPost, index: number, isFromDrafts: boolean) => {
    try {
      const regenerated = await generateSingleSocialPost(
        post.platform,
        idea,
        tone,
        brandGuidelines,
        brandWebsite
      );

      const updatedPost = { ...post, ...regenerated };

      if (isFromDrafts) {
        setGeneratedPosts(prev => {
          const newPosts = [...prev];
          newPosts[index] = updatedPost;
          return newPosts;
        });
      } else {
        await handleUpdatePost(updatedPost as any);
      }
    } catch (error: any) {
      console.error("Failed to regenerate post:", error);
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Failed to regenerate post content: ${error.message || "API error"}.`, type: "error" },
        ...prev
      ]);
      setShowNotifications(true);
    }
  };

  const handleApprove = async (postId: string) => {
    if (!user) {
      setNotifications(prev => [
        { id: Math.random().toString(), message: "Please log in to approve posts.", type: "error" },
        ...prev
      ]);
      setShowNotifications(true);
      return;
    }
    console.log("Approving post:", postId);
    try {
      const post = scheduledPosts.find(p => p.id === postId);
      if (!post) {
        console.error("Post not found in scheduledPosts:", postId);
        return;
      }

      const isConnected = platformConnections[post.platform];
      console.log(`Platform ${post.platform} connected: ${isConnected}`);
      
      if (isConnected) {
        setNotifications(prev => [
          { id: Math.random().toString(), message: `Publishing to ${post.platform}...`, type: "info" },
          ...prev
        ]);
        
        const idToken = await user.getIdToken();
        const response = await fetch(getApiUrl("/api/publish"), {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            platform: post.platform,
            content: post.content,
            hashtags: post.hashtags,
            userId: user.uid,
            postId: postId
          })
        });

        if (response.ok) {
          setNotifications(prev => [
            { id: Math.random().toString(), message: `Successfully published post to ${post.platform}!`, type: "info" },
            ...prev
          ]);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to publish via backend");
        }
      } else {
        await updateDoc(doc(db, "posts", postId), { status: "approved" });
        
        setNotifications(prev => [
          { id: Math.random().toString(), message: `Post approved! It will be published when the scheduled time arrives.`, type: "info" },
          ...prev
        ]);
      }
    } catch (error: any) {
      console.error("Failed to approve/publish post:", error);
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Error: ${error.message || "Failed to process post."}`, type: "warning" },
        ...prev
      ]);
      // No need for fetchPosts here as we use onSnapshot
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'dark' | 'light') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'dark') setBrandLogoDark(reader.result as string);
        else setBrandLogoLight(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveSettings = async (currentSettings: any) => {
    if (!user) {
      return;
    }
    
    setIsSavingSettings(true);
    try {
      const settingsData = {
        uid: user.uid,
        email: user.email,
        showCelebrations,
        celebrationFilter,
        ...currentSettings
      };

      await setDoc(doc(db, "users", user.uid), settingsData, { merge: true });
      // Show success state briefly
      setTimeout(() => setIsSavingSettings(false), 1000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setIsSavingSettings(false);
    }
  };

  const handleSavePixazo = async () => {
    if (!isSuperAdmin) return;
    setIsSavingPixazo(true);
    const path = "system_config/image_generation";
    try {
      await setDoc(doc(db, "system_config", "image_generation"), {
        pixazoApiKey: globalPixazoApiKey,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      }, { merge: true });
      
      setNotifications(prev => [
        { id: Math.random().toString(), message: "Pixazo API configurations saved successfully!", type: "success" },
        ...prev
      ]);
      setShowNotifications(true);
    } catch (error: any) {
      console.error("Failed to save Pixazo config:", error);
      
      // Attempt to handle via specific error handler for metadata
      try {
        handleFirestoreError(error, OperationType.WRITE, path);
      } catch (innerError: any) {
        setNotifications(prev => [
          { id: Math.random().toString(), message: `Failed to save Pixazo config: ${error.message}`, type: "error" },
          ...prev
        ]);
        setShowNotifications(true);
      }
    } finally {
      setIsSavingPixazo(false);
    }
  };

  const handleSaveSettings = async () => {
    setGeminiApiKeys(geminiApiKeys);
    localStorage.setItem("gemini_api_keys", JSON.stringify(geminiApiKeys));
    
    // Sync shared keys to central collection
    if (user) {
      const sharedKeys = geminiApiKeys.filter(k => k.shared && k.key.trim() !== "");
      // In a real app we'd carefully manage this collection to avoid orphans
      for (const k of sharedKeys) {
        // Use a simple hash of the key as ID to avoid duplicates
        const keyHash = btoa(k.key).substring(0, 32).replace(/[/+=]/g, '');
        await setDoc(doc(db, "shared_api_keys", keyHash), {
          key: k.key,
          ownerId: user.uid,
          updatedAt: serverTimestamp()
        });
      }
    }

    await saveSettings({
      brandGuidelines,
      brandLogoDark,
      brandLogoLight,
      brandWebsite,
      imageStyle,
      platformConnections,
      geminiApiKeys,
      showCelebrations,
      celebrationFilter,
      pixazoApiKey: userPixazoApiKey
    });
  };

  const handleConnectPlatform = async (platform: string) => {
    if (platformConnections[platform]) {
      // Disconnect
      setPlatformConnections(prev => {
        const newConnections = { ...prev, [platform]: false };
        if (user) {
          saveSettings({
            brandGuidelines,
            brandLogoDark,
            brandLogoLight,
            brandWebsite,
            imageStyle,
            platformConnections: newConnections,
            geminiApiKeys
          });
        }
        return newConnections;
      });
      return;
    }

    setConnectingPlatform(platform);
    
    try {
      const publicOrigin = (window.location.origin.includes('localhost') && !window.location.port) || window.location.protocol.includes('capacitor')
        ? "https://ais-dev-cb6kmlkwf7ovv7riiuq7em-598054090778.asia-southeast1.run.app" // Still needed for local dev, but we verify it's the right one
        : window.location.origin;

      const response = await fetch(getApiUrl(`/api/auth/url/${platform}?origin=${publicOrigin}&uid=${user?.uid}`));
      if (!response.ok) throw new Error("Failed to get auth URL");
      
      const { url } = await response.json();
      
      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
        setConnectingPlatform(null);
      }
    } catch (error) {
      console.error("OAuth error:", error);
      setConnectingPlatform(null);
    }
  };

  const handleSidebarScroll = (e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load more when reaching near the bottom and having more to show
    if (showCelebrations && scrollTop + clientHeight >= scrollHeight - 100) {
      setVisibleCelebrationsCount(prev => prev + 5);
    }
  };

  if (!isAuthReady) return null;
  if (!user) return <Login />;

  const logOut = async () => {
    await signOut(auth);
  };

  const isSuperAdmin = user?.email === "kumarsujit24@gmail.com" && user?.emailVerified;

  const upcomingScheduled = scheduledPosts.filter(p => {
    try {
      const scheduledDate = new Date(p.scheduledAt);
      if (isNaN(scheduledDate.getTime())) return false;
      return p.status === "scheduled" && isBefore(scheduledDate, addDays(new Date(), 1));
    } catch (e) {
      return false;
    }
  });

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col lg:flex-row bg-[#fafafa]">
      {/* Sidebar */}
      <aside 
        onScroll={handleSidebarScroll}
        className="lg:w-[450px] lg:h-screen lg:sticky lg:top-0 bg-white border-r border-slate-200 p-8 overflow-y-auto flex flex-col relative"
      >
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">ImaGenie</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button 
              onClick={logOut} 
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="mb-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Super Admin</h3>
            <div className="flex gap-1 bg-red-50/50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("admin-dashboard")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "admin-dashboard" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-red-400"
                }`}
              >
                <Activity className="w-3 h-3" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("admin-users")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "admin-users" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-red-400"
                }`}
              >
                <Users className="w-3 h-3" />
                Users
              </button>
            </div>
          </div>
        )}

        <nav className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-12">
          <button
            onClick={() => setActiveTab("generate")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "generate" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Generate
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "calendar" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "settings" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Settings
          </button>
        </nav>

        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute left-8 right-8 top-32 lg:top-40 bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4 max-h-[600px] overflow-y-auto z-[100] border-t-4 border-t-indigo-600"
            >
              <div className="flex items-center justify-between mb-2 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Notification Center</h4>
                </div>
                <button onClick={() => setNotifications([])} className="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all">Clear All</button>
              </div>
              {notifications.length > 0 ? (
                notifications.map(n => (
                  <div key={n.id} className={`p-4 rounded-2xl text-sm flex gap-3 transition-all hover:scale-[1.01] hover:shadow-md border shadow-sm ${
                    n.type === 'error' ? 'bg-rose-50 text-rose-900 border-rose-100' : 
                    n.type === 'warning' ? 'bg-amber-50 text-amber-900 border-amber-100' : 
                    'bg-indigo-50 text-indigo-900 border-indigo-100'
                  }`}>
                    <div className="flex-1 leading-relaxed font-medium break-words">{n.message}</div>
                    <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} className="opacity-40 hover:opacity-100 text-xl leading-none px-1 h-fit">×</button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">Your inbox is empty</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "generate" ? (
          <div className="space-y-8 flex-1">
            <section>
              <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-indigo-500" />
                Your Idea
              </label>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="e.g. A new feature launch for our productivity app that uses AI to summarize meetings..."
                className="input-field min-h-[160px] resize-none text-slate-600"
              />
            </section>

            <section>
              <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-500" />
                Tone & Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      tone === t 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-500" />
                  Target Platforms
                </label>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                      selectedPlatforms.includes(p)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !idea.trim() || selectedPlatforms.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Thinking Deeply...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generate Content
                </>
              )}
            </button>
            
            {geminiApiKeys.length === 0 && (
              <button
                onClick={() => setActiveHelpPlatform("Gemini")}
                className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-all uppercase tracking-widest"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Need a free Gemini API Key?
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8 flex-1">
            <section className="glass-panel p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-display font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  Upcoming Schedule
                </h3>
                {upcomingScheduled.length > 0 && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                    {upcomingScheduled.length} Due Soon
                  </span>
                )}
              </div>
              {upcomingScheduled.length > 0 ? (
                <div className="space-y-4">
                  {upcomingScheduled.map((p) => (
                    <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{p.platform}</span>
                          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                          <span className="text-[10px] text-slate-400 font-bold">{format(new Date(p.scheduledAt), "MMM d, h:mm a")}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 font-medium italic">"{p.content.substring(0, 40)}..."</p>
                      </div>
                      <button 
                        onClick={() => handleApprove(p.id)} 
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Publish Now"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <CalendarIcon className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Nothing due in next 24h.</p>
                </div>
              )}
            </section>
          </div>
        )}

          <div className="mt-12 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                Upcoming Celebrations {celebrationFilter !== "All" && `(${celebrationFilter})`}
              </h3>
              <div className="flex items-center gap-3">
                {isFetchingCelebrations && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                <button 
                  onClick={() => setShowCelebrations(!showCelebrations)}
                  className={`w-10 h-5 rounded-full transition-all relative ${showCelebrations ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${showCelebrations ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
            {showCelebrations && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                {celebrations
                  .filter(c => {
                    // Region filter
                    if (celebrationFilter !== "All" && c.country !== celebrationFilter) return false;

                    const celebrationDate = new Date(c.date);
                    const now = new Date();
                    const currentMonth = now.getMonth();
                    const currentYear = now.getFullYear();
                    const celebrationMonth = celebrationDate.getMonth();
                    const celebrationYear = celebrationDate.getFullYear();
                    
                    // Show if it's current month or next month of current year
                    const isCurrentMonth = celebrationMonth === currentMonth && celebrationYear === currentYear;
                    const isNextMonth = (celebrationMonth === (currentMonth + 1) % 12) && 
                                      (celebrationMonth === 0 ? celebrationYear === currentYear + 1 : celebrationYear === currentYear);
                    
                    return isCurrentMonth || isNextMonth;
                  })
                  .slice(0, visibleCelebrationsCount)
                  .map((c, i) => (
                  <div 
                    key={i} 
                    className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100"
                  >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-600">{c.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium uppercase tracking-wider">
                        {c.country}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{format(new Date(c.date), "MMM d")}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 group-hover:line-clamp-none transition-all mb-3">
                    {c.description}
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIdea(`Create a post for ${c.name} on ${c.date}. ${c.description}`)}
                      className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Use as Idea
                    </button>
                    <button 
                      onClick={() => {
                        setIdea(`Create a post for ${c.name} on ${c.date}. ${c.description}`);
                        setTimeout(handleGenerate, 100);
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Generate Post
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 p-8 lg:p-12 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === "generate" && generatedPosts.length > 0 ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-display font-bold text-slate-900">Generated Content</h2>
                <span className="text-sm text-slate-500">{generatedPosts.length} posts ready</span>
              </div>
              <div className="grid gap-8">
                {generatedPosts.map((post, index) => (
                  <PostCard 
                    key={index} 
                    post={post} 
                    brandGuidelines={brandGuidelines}
                    brandLogoDark={brandLogoDark || undefined}
                    brandLogoLight={brandLogoLight || undefined}
                    brandWebsite={brandWebsite}
                    imageStyle={imageStyle}
                    isPlatformConnected={platformConnections[post.platform]}
                    pixazoApiKey={userPixazoApiKey || globalPixazoApiKey}
                    notify={(msg, type) => {
                      setNotifications(prev => [{ id: Math.random().toString(), message: msg, type }, ...prev]);
                      setShowNotifications(true);
                    }}
                    onSchedule={(date) => handleSchedule(post, date)}
                    onApprove={() => handleSchedule(post, new Date().toISOString(), "approved")}
                    onUpdate={(updated) => {
                      setGeneratedPosts(prev => {
                        const newPosts = [...prev];
                        newPosts[index] = updated;
                        return newPosts;
                      });
                    }}
                    onRegenerate={() => handleRegeneratePost(post, index, true)}
                  />
                ))}
              </div>
            </motion.div>
          ) : activeTab === "calendar" ? (
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-7xl mx-auto space-y-8"
            >
              <CalendarView 
                posts={scheduledPosts} 
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onPostClick={setPreviewPost}
              />

              {/* Pipeline View */}
              <div className="mt-12">
                <h3 className="text-lg font-display font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Layout className="w-5 h-5 text-indigo-500" />
                  Content Pipeline
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {['scheduled', 'published'].map((status) => (
                    <div key={status} className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{status}</h4>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {scheduledPosts.filter(p => p.status === status).length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {scheduledPosts
                          .filter(p => p.status === status)
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .slice(0, 5)
                          .map(p => (
                            <div key={p.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-indigo-600 uppercase">{p.platform}</span>
                                  {p.scheduledAt && (
                                    <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                                      {format(new Date(p.scheduledAt), "MMM d, h:mm a")}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setPreviewPost(p)}
                                  className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-all hover:underline"
                                >
                                  Preview
                                </button>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2 font-medium leading-relaxed">{p.content}</p>
                            </div>
                          ))}
                        {scheduledPosts.filter(p => p.status === status).length === 0 && (
                          <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">No Content</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : activeTab === "settings" ? (
            <motion.div
              key="settings-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto space-y-12"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold text-slate-900">Brand & Platform Settings</h2>
                <button 
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="btn-primary flex items-center gap-2 px-6"
                >
                  {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <section className="glass-panel p-8 rounded-3xl">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Layout className="w-5 h-5 text-indigo-600" />
                      Brand Profile
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Image Generation Style</label>
                        <select 
                          value={imageStyle}
                          onChange={(e) => setImageStyle(e.target.value)}
                          className="input-field"
                        >
                          {["Photorealistic", "Digital Art", "Minimalist", "3D Render", "Vintage", "Cyberpunk", "Oil Painting", "Vector Art"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Website URL</label>
                        <input
                          type="url"
                          value={brandWebsite}
                          onChange={(e) => setBrandWebsite(e.target.value)}
                          placeholder="https://yourbrand.com"
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Guidelines</label>
                        <textarea
                          value={brandGuidelines}
                          onChange={(e) => setBrandGuidelines(e.target.value)}
                          placeholder="Describe your brand voice, colors, and style..."
                          className="input-field min-h-[120px] resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dark Logo</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer">
                            <div className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 text-slate-500">
                              <Layout className="w-4 h-4" />
                              <span className="text-sm font-medium">{brandLogoDark ? "Change Dark Logo" : "Upload Dark Logo"}</span>
                            </div>
                            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'dark')} className="hidden" />
                          </label>
                          {brandLogoDark && (
                            <img src={brandLogoDark} alt="Dark Logo" className="w-16 h-16 rounded-2xl object-contain bg-white border border-slate-100 p-2" />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Light Logo</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 cursor-pointer">
                            <div className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 text-slate-500">
                              <Layout className="w-4 h-4" />
                              <span className="text-sm font-medium">{brandLogoLight ? "Change Light Logo" : "Upload Light Logo"}</span>
                            </div>
                            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'light')} className="hidden" />
                          </label>
                          {brandLogoLight && (
                            <img src={brandLogoLight} alt="Light Logo" className="w-16 h-16 rounded-2xl object-contain bg-white border border-slate-100 p-2" />
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="glass-panel p-8 rounded-3xl mt-6">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      Celebration Display
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-700">Show Upcoming Celebrations</p>
                          <p className="text-xs text-slate-500">Display festivals and special days in the sidebar</p>
                        </div>
                        <button 
                          onClick={() => setShowCelebrations(!showCelebrations)}
                          className={`w-12 h-6 rounded-full transition-all relative ${showCelebrations ? 'bg-indigo-600' : 'bg-slate-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showCelebrations ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>

                      {showCelebrations && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Region Filter</label>
                          <div className="flex p-1 bg-slate-100 rounded-xl">
                            {["All", "India", "USA"].map(filter => (
                              <button
                                key={filter}
                                onClick={() => setCelebrationFilter(filter)}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                  celebrationFilter === filter 
                                    ? "bg-white text-indigo-600 shadow-sm" 
                                    : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                {filter}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="glass-panel p-8 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-500">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Send className="w-5 h-5 text-indigo-600" />
                        Platform Connections
                      </h3>
                      <button 
                        onClick={() => setShowConnectGuide(!showConnectGuide)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          showConnectGuide 
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                            : "bg-slate-50 text-indigo-600 hover:bg-slate-100"
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        {showConnectGuide ? "Hide Guide" : "Setup Guide"}
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">
                      Connect your social media accounts to enable automatic publishing of scheduled posts.
                    </p>

                    <AnimatePresence>
                      {showConnectGuide && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                          animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
                          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 bg-slate-50 border border-indigo-100 rounded-[2rem] space-y-4">
                            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5" />
                              Connection Steps
                            </h4>
                            <div className="space-y-4">
                              {[
                                { step: 1, title: "Authorize", desc: "Click 'Connect' to open a secure link to your selected platform." },
                                { step: 2, title: "Grant Access", desc: "Log in and allow ImaGenie to post content on your behalf." },
                                { step: 3, title: "Confirm Sync", desc: "Once authorized, the status will turn 'Connected' in green." },
                                { step: 4, title: "Enable Auto-Post", desc: "Your scheduled posts will now publish automatically!" }
                              ].map((s) => (
                                <div key={s.step} className="flex gap-4">
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 shadow-sm">
                                    {s.step}
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-900 leading-tight mb-1">{s.title}</p>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{s.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-3">
                      {PLATFORMS.map(platform => (
                        <div key={platform} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all group/platform shadow-sm hover:shadow-indigo-100/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-50 group-hover/platform:bg-indigo-50 rounded-xl flex items-center justify-center transition-colors">
                              <span className="text-sm font-bold text-slate-400 group-hover/platform:text-indigo-600 uppercase">{platform[0]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700">{platform}</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveHelpPlatform(platform);
                                }}
                                className="text-slate-300 hover:text-indigo-400 p-1 rounded-full hover:bg-white transition-all"
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => handleConnectPlatform(platform)}
                            disabled={connectingPlatform === platform}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                              platformConnections[platform]
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 shadow-sm"
                            }`}
                          >
                            {connectingPlatform === platform ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Connecting
                              </>
                            ) : (
                              <>
                                {platformConnections[platform] ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    Connected
                                  </>
                                ) : "Connect"}
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="glass-panel p-8 rounded-3xl">
                    <h3 className="text-lg font-bold mb-6 flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-600" />
                        Gemini API Keys
                      </div>
                      <button 
                        onClick={() => setActiveHelpPlatform("Gemini")}
                        className="text-slate-300 hover:text-indigo-600 p-2 rounded-full hover:bg-white transition-all shadow-hover"
                        title="View Setup Guide"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </h3>

                    <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        How to get a free API Key?
                      </h4>
                      <ol className="text-xs text-slate-600 space-y-3 list-decimal pl-4 font-medium">
                        <li>Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">Google AI Studio</a></li>
                        <li>Sign in with your Google Account</li>
                        <li>Click on <strong>"Create API key"</strong></li>
                        <li>Copy the generated key and paste it below</li>
                        <li>You can add multiple keys to avoid per-key rate limits</li>
                      </ol>
                    </div>

                    <p className="text-sm text-slate-500 mb-6">
                      Add multiple API keys to handle higher quotas. The system will automatically rotate keys if one is exhausted (Max 100).
                    </p>
                    <div className="space-y-3">
                      {geminiApiKeys.map((keyConfig, index) => {
                        const { key, shared } = keyConfig;
                        const status = apiKeyStatuses.find(s => s.key === key);
                        const isPlatformKey = key === process.env.GEMINI_API_KEY;
                        
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="password"
                                  value={key}
                                  readOnly={isPlatformKey}
                                  onChange={(e) => {
                                    const newKeys = [...geminiApiKeys];
                                    newKeys[index] = { ...newKeys[index], key: e.target.value };
                                    setGeminiApiKeysState(newKeys);
                                  }}
                                  placeholder={isPlatformKey ? "Default Platform Key" : `API Key #${index + 1}`}
                                  className={`input-field w-full ${isPlatformKey ? "bg-slate-50 opacity-70" : ""}`}
                                />
                                {isPlatformKey && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    DEFAULT
                                  </span>
                                )}
                              </div>
                              {!isPlatformKey && (
                                <>
                                  <button
                                    onClick={() => {
                                      const newKeys = [...geminiApiKeys];
                                      newKeys[index] = { ...newKeys[index], shared: !newKeys[index].shared };
                                      setGeminiApiKeysState(newKeys);
                                    }}
                                    className={`p-3 rounded-xl border transition-all flex items-center justify-center ${shared ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                    title={shared ? "Shared Key (Others can use this)" : "Mark as Shared API Key"}
                                  >
                                    <Share2 className={`w-4 h-4 ${shared ? 'fill-emerald-600' : ''}`} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newKeys = geminiApiKeys.filter((_, i) => i !== index);
                                      setGeminiApiKeysState(newKeys);
                                    }}
                                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                            {status && (
                              <div className="flex flex-col gap-1 px-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <div className={`w-1.5 h-1.5 rounded-full ${status.status === 'Active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${status.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>
                                      {status.status}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium ml-1">
                                      ({status.requestsCount} successful)
                                    </span>
                                  </div>
                                  {status.status === 'Exhausted' && status.nextAvailable && (
                                    <div className="flex items-center gap-1 text-[10px] text-red-500 font-black uppercase tracking-widest">
                                      <Clock className="w-3 h-3" />
                                      {Math.max(0, Math.ceil((status.nextAvailable - Date.now()) / 1000))}s
                                    </div>
                                  )}
                                </div>
                                {status.lastError && (
                                  <span className="text-[9px] text-red-400 font-medium truncate" title={status.lastError}>
                                    Last error: {status.lastError}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {geminiApiKeys.length < 100 && (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setGeminiApiKeysState([...geminiApiKeys, { key: "", shared: false }])}
                            className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Add More API Key
                          </button>
                          
                          {(window as any).aistudio && (
                            <button
                              onClick={async () => {
                                try {
                                  await (window as any).aistudio.openSelectKey();
                                  setNotifications(prev => [
                                    { id: Math.random().toString(), message: "AI Studio API Key selected. Please refresh or save settings to apply.", type: "info" },
                                    ...prev
                                  ]);
                                  setShowNotifications(true);
                                } catch (e) {
                                  console.error("Failed to open key selection:", e);
                                }
                              }}
                              className={`w-full p-4 rounded-2xl transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest ${
                                process.env.API_KEY 
                                  ? "bg-green-50 text-green-600 hover:bg-green-100" 
                                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              }`}
                            >
                              <Key className="w-4 h-4" />
                              {process.env.API_KEY ? "AI Studio Key Selected" : "Select AI Studio Key"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="glass-panel p-8 rounded-3xl mt-6 border border-indigo-100 bg-indigo-50/10">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-indigo-600" />
                      Image Generation (Pixazo)
                    </h3>
                    <div className="space-y-6">
                      <div className="p-4 bg-white/50 border border-indigo-100 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Fallback API</span>
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${globalPixazoApiKey ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                            {globalPixazoApiKey ? 'Active & Ready' : 'Not Configured'}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                          The system provides a global Pixazo API key for all users as a default. If you don't provide your own, this key will be used for all image generations.
                        </p>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Your Personal Pixazo API Key</label>
                        <div className="relative group">
                          <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          <input
                            type="password"
                            value={userPixazoApiKey}
                            onChange={(e) => setUserPixazoApiKey(e.target.value)}
                            placeholder="Enter your personal Pixazo API Key..."
                            className="input-field pl-11 font-mono text-xs tracking-widest bg-white border-indigo-50 focus:border-indigo-300 transition-colors"
                          />
                        </div>
                        <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                          <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[10px] text-amber-800 font-medium leading-relaxed italic">
                            * Providing a personal key is recommended for higher limits and private usage. If left blank, the global shared key will handle your requests.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                  
                  {isSuperAdmin && (
                    <section className="glass-panel p-8 rounded-3xl mt-6 border border-rose-100 bg-rose-50/10">
                      <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-600">
                          <Wand2 className="w-5 h-5" />
                          Global Image API (Pixazo)
                        </div>
                        <button 
                          onClick={handleSavePixazo}
                          disabled={isSavingPixazo}
                          className="px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 transition-all disabled:opacity-50 shadow-lg shadow-rose-100"
                        >
                          {isSavingPixazo ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Save Global Config"}
                        </button>
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fallback Pixazo API Key</label>
                          <div className="relative group">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                            <input
                              type="password"
                              value={globalPixazoApiKey}
                              onChange={(e) => setGlobalPixazoApiKey(e.target.value)}
                              placeholder="Enter Global Pixazo API Key..."
                              className="input-field pl-11 font-mono text-xs tracking-widest bg-white border-rose-50 focus:border-rose-300 transition-colors"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-3 font-medium leading-relaxed italic">
                            * This key enables image generation for all users who haven't added their own Gemini API key yet.
                          </p>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </motion.div>
          ) : activeTab === "admin-dashboard" ? (
            <AdminDashboard />
          ) : activeTab === "admin-users" ? (
            <AdminUsers />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto"
            >
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-6">
                <Sparkles className="w-10 h-10 text-slate-200" />
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">Ready to create?</h2>
              <p className="text-slate-500">
                Enter your idea on the left and select your target platforms. We'll handle the copywriting and visuals.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <HelpModal 
        platform={activeHelpPlatform || ""} 
        isOpen={!!activeHelpPlatform} 
        onClose={() => setActiveHelpPlatform(null)} 
      />

      <AnimatePresence>
        {previewPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewPost(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Post Preview</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{previewPost.platform} • {previewPost.status}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewPost(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  <Markdown>{previewPost.content}</Markdown>
                  {previewPost.hashtags && previewPost.hashtags.length > 0 && (
                    <div className="mt-4 text-indigo-600 font-bold">
                      {previewPost.hashtags.join(" ")}
                    </div>
                  )}
                </div>

                {previewPost.imageData && (
                  <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                    <img 
                      src={Array.isArray(previewPost.imageData) ? previewPost.imageData[0] : previewPost.imageData} 
                      alt="Post visual" 
                      className="w-full aspect-square object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
                  <span>Scheduled Publication</span>
                  <span className="text-slate-900 font-bold">
                    {(() => {
                      try {
                        const date = new Date(previewPost.scheduledAt);
                        if (isNaN(date.getTime())) return "Invalid Date";
                        return format(date, "MMMM d, h:mm a");
                      } catch (e) {
                        return "Invalid Date";
                      }
                    })()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    handleApprove(previewPost.id);
                    setPreviewPost(null);
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
                >
                  <Send className="w-4 h-4" />
                  Publish Manually Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
