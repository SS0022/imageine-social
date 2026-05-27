import { Twitter, Linkedin, Instagram, Facebook, MessageCircle, Copy, Download, Image as ImageIcon, Loader2, Calendar, CheckCircle2, Clock, Send, RefreshCw, Edit2, Save, X, Info, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { GeneratedPost, generatePostImage } from "../services/gemini";
import { motion, AnimatePresence } from "motion/react";

interface PostCardProps {
  post: GeneratedPost;
  onSchedule?: (date: string) => void;
  onApprove?: () => void;
  onUpdate?: (updatedPost: GeneratedPost) => void;
  onRegenerate?: () => Promise<void>;
  notify?: (message: string, type: "info" | "warning" | "success" | "error") => void;
  status?: string;
  scheduledAt?: string;
  brandGuidelines?: string;
  brandLogoDark?: string;
  brandLogoLight?: string;
  brandWebsite?: string;
  imageStyle?: string;
  isPlatformConnected?: boolean;
  pixazoApiKey?: string;
}

export const PostCard = ({ 
  post, 
  onSchedule, 
  onApprove, 
  onUpdate,
  onRegenerate,
  notify,
  status = "draft", 
  scheduledAt,
  brandGuidelines,
  brandLogoDark,
  brandLogoLight,
  brandWebsite,
  imageStyle = "Photorealistic",
  isPlatformConnected,
  pixazoApiKey
}: PostCardProps) => {
  const [image, setImage] = useState<string | string[] | null>(post.imageData || null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [localImageStyle, setLocalImageStyle] = useState(post.imageStyle || imageStyle);
  const [localImageType, setLocalImageType] = useState<"Single" | "Carousel">(post.imageType || "Single");
  const [carouselCount, setCarouselCount] = useState(post.carouselCount || 3);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sync local image state with post data when it changes externally (e.g. from parent regeneration)
  useEffect(() => {
    setImage(post.imageData || null);
    setEditedContent(post.content);
    setEditedHashtags(post.suggestedHashtags.join(" "));
  }, [post.imageData, post.content, post.suggestedHashtags]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [editedHashtags, setEditedHashtags] = useState(post.suggestedHashtags.join(" "));
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      notify?.("File is too large. Please upload an image under 5MB.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setImage(b64);
      onUpdate?.({
        ...post,
        imageData: b64,
        imageType: "Single"
      });
      notify?.("Image uploaded successfully!", "success");
    };
    reader.readAsDataURL(file);
  };

  const getIcon = () => {
    switch (post.platform.toLowerCase()) {
      case "twitter":
      case "x":
        return <Twitter className="w-5 h-5 text-sky-500" />;
      case "linkedin":
        return <Linkedin className="w-5 h-5 text-blue-700" />;
      case "instagram":
        return <Instagram className="w-5 h-5 text-pink-600" />;
      case "facebook":
        return <Facebook className="w-5 h-5 text-blue-600" />;
      case "threads":
        return <MessageCircle className="w-5 h-5 text-black" />;
      default:
        return null;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(post.content + "\n\n" + post.suggestedHashtags.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const imgUrl = await generatePostImage(
        post.content, 
        brandGuidelines, 
        brandLogoDark, 
        brandLogoLight, 
        brandWebsite, 
        localImageStyle, 
        localImageType, 
        carouselCount,
        pixazoApiKey
      );
      setImage(imgUrl);
      // Persist the new image data to parent state/database
      onUpdate?.({
        ...post,
        imageData: imgUrl as any,
        imageStyle: localImageStyle,
        imageType: localImageType,
        carouselCount: carouselCount
      });
    } catch (error: any) {
      console.error("Failed to generate image:", error);
      notify?.(`Failed to generate image: ${error.message || "Please try again."}`, "warning");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveEdit = () => {
    const updatedPost = {
      ...post,
      content: editedContent,
      suggestedHashtags: editedHashtags.split(" ").filter(t => t.trim() !== "").map(t => t.startsWith("#") ? t : `#${t}`)
    };
    onUpdate?.(updatedPost);
    setIsEditing(false);
  };

  const handleRegenerateContent = async () => {
    setIsRegenerating(true);
    try {
      await onRegenerate?.();
      // Reset edit fields after regeneration
      setEditedContent(post.content);
      setEditedHashtags(post.suggestedHashtags.join(" "));
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleApprove = async () => {
    if (status === "approved" && isPlatformConnected) {
      setIsPublishing(true);
      // Simulate publishing delay
      setTimeout(() => {
        onApprove?.();
        setIsPublishing(false);
      }, 1500);
    } else {
      onApprove?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden"
    >
      {status === "approved" && (
        <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Approved
        </div>
      )}

      {status === "published" && (
        <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 text-xs font-bold rounded-bl-lg flex items-center gap-1">
          <Send className="w-3 h-3" /> Published
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="font-display font-semibold text-lg capitalize">{post.platform}</span>
        </div>
        <div className="flex items-center gap-2">
          {post.publishedUrl && (
            <a 
              href={post.publishedUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs text-indigo-600 font-bold"
            >
              View Post <Send className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Edit Post"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRegenerateContent}
            disabled={isRegenerating}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 disabled:opacity-50"
            title="Regenerate Content"
          >
            <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative"
            title="Copy to clipboard"
          >
            {copied ? <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs bg-slate-800 text-white px-2 py-1 rounded">Copied!</span> : null}
            <Copy className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="input-field min-h-[120px] text-sm resize-none"
            placeholder="Post content..."
          />
          <input
            type="text"
            value={editedHashtags}
            onChange={(e) => setEditedHashtags(e.target.value)}
            className="input-field text-sm"
            placeholder="Hashtags (space separated)..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <Save className="w-3 h-3" /> Save Changes
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedContent(post.content);
                setEditedHashtags(post.suggestedHashtags.join(" "));
              }}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
            <Markdown>{post.content}</Markdown>
          </div>

          <div className="flex flex-wrap gap-2">
            {post.suggestedHashtags.map((tag, i) => (
              <span key={i} className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</span>
              <select 
                value={localImageType} 
                onChange={(e) => setLocalImageType(e.target.value as any)}
                className="text-xs bg-transparent outline-none font-medium text-slate-700"
              >
                <option value="Single">Single Image</option>
                <option value="Carousel">Carousel</option>
              </select>
            </div>
            {localImageType === "Carousel" && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Slides</span>
                <input 
                  type="number" 
                  min="2" 
                  max="10" 
                  value={carouselCount} 
                  onChange={(e) => setCarouselCount(parseInt(e.target.value))}
                  className="text-xs bg-transparent outline-none font-medium text-slate-700 w-8"
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Style</span>
              <select 
                value={localImageStyle} 
                onChange={(e) => setLocalImageStyle(e.target.value)}
                className="text-xs bg-transparent outline-none font-medium text-slate-700"
              >
                {["Photorealistic", "Minimalist", "Vibrant", "Professional", "3D Render", "Illustration", "Cinematic", "Anime"].map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Photo
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {image ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setShowOverlay(!showOverlay)}
              className="relative group rounded-xl overflow-hidden cursor-pointer"
            >
              <img src={typeof image === 'string' ? image : image[0]} alt="Generated visual" className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
              <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center gap-4 ${showOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleGenerateImage(); }}
                  disabled={isGeneratingImage}
                  className="p-4 bg-white/95 backdrop-blur-sm rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl group/btn border border-indigo-100 hover:border-indigo-400 group-hover:bg-gradient-to-br from-indigo-50 to-white"
                  title="Regenerate Image"
                  id="regenerate-image-btn"
                >
                  {isGeneratingImage ? (
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  ) : (
                    <RefreshCw className="w-6 h-6 text-indigo-600 group-hover/btn:rotate-180 transition-all duration-700" />
                  )}
                </button>
                <a
                  href={typeof image === 'string' ? image : image[0]}
                  download={`post-${post.platform}.png`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-4 bg-white/95 backdrop-blur-sm rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-xl border border-slate-100"
                  title="Download Image"
                >
                  <Download className="w-6 h-6 text-slate-900" />
                </a>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage}
              className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group"
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-sm font-medium text-indigo-500">Generating visual...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Generate AI Visual</span>
                </>
              )}
            </button>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3">
          {(status === "draft" || status === "approved") && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  className={`flex-1 py-2 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${showScheduler ? 'bg-slate-100 border-slate-300' : 'border-slate-200 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600'}`}
                >
                  <Calendar className="w-4 h-4" />
                  {showScheduler ? "Cancel" : "Schedule"}
                </button>
                <button
                  onClick={() => {
                    if (image) post.imageData = image;
                    handleApprove();
                  }}
                  disabled={isPublishing}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 active:scale-95"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Now
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowManualGuide(!showManualGuide)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${showManualGuide ? 'bg-slate-100 border-slate-300' : 'border-slate-200 hover:bg-slate-50 hover:border-amber-200 hover:text-amber-700'}`}
                >
                  <Edit2 className="w-4 h-4" />
                  Manual Post
                </button>
              </div>
              
              <AnimatePresence>
                {showManualGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-3 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                      <Info className="w-4 h-4" />
                      Manual Publishing Guide
                    </div>
                    <div className="space-y-2 text-xs text-amber-900/80 leading-relaxed">
                      {!isPlatformConnected && (
                        <p className="font-bold text-amber-700">⚠️ Your {post.platform} account is not connected for direct API publishing.</p>
                      )}
                      <p>1. <strong>Copy</strong> the post content using the copy icon at the top.</p>
                      <p>2. <strong>Download</strong> the image using the download icon on the image.</p>
                      <p>3. <strong>Open</strong> {post.platform} and paste your content + upload the downloaded image.</p>
                      <button 
                        onClick={handleCopy}
                        className="w-full mt-2 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Content Now
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isPlatformConnected && !showManualGuide && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5" />
                    <span>Direct API Access</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium italic">Auto-generated for {post.platform}</span>
                </div>
              )}
            </div>
          )}
          {showScheduler && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="space-y-2"
            >
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="input-field py-2"
              />
              <button
                onClick={() => {
                  onSchedule?.(scheduleDate);
                  // Pass image data if it was generated
                  if (image) {
                    post.imageData = image;
                  }
                  setShowScheduler(false);
                }}
                disabled={!scheduleDate}
                className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Confirm Schedule
              </button>
            </motion.div>
          )}

          {status === "scheduled" && (
            <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <Clock className="w-4 h-4" />
                <span>
                  Scheduled for {(() => {
                    try {
                      const date = new Date(scheduledAt!);
                      if (isNaN(date.getTime())) return "Invalid Date";
                      return date.toLocaleString();
                    } catch (e) {
                      return "Invalid Date";
                    }
                  })()}
                </span>
              </div>
              <button
                onClick={onApprove}
                className="text-xs font-bold text-amber-800 hover:underline"
              >
                Approve Now
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
