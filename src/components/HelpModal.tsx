import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink, Play, BookOpen, Info } from "lucide-react";

interface HelpContent {
  title: string;
  quickHelp: string;
  docsLink: string;
  videoLink: string;
}

interface HelpModalProps {
  platform: string;
  isOpen: boolean;
  onClose: () => void;
}

const PLATFORM_HELP: Record<string, HelpContent> = {
  Twitter: {
    title: "Twitter Integration Guide",
    quickHelp: "To connect Twitter, you'll need to authorize ImaGenie to post on your behalf. We use OAuth 2.0 to securely handle your credentials.",
    docsLink: "https://developer.twitter.com/en/docs/twitter-api/getting-started/about-twitter-api",
    videoLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" // Placeholder for demonstration
  },
  LinkedIn: {
    title: "LinkedIn Integration Guide",
    quickHelp: "LinkedIn requires a professional or personal profile. You will be redirected to LinkedIn to grant permission for 'w_member_social'.",
    docsLink: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/oauth-2-0",
    videoLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  },
  Instagram: {
    title: "Instagram Integration Guide",
    quickHelp: "Instagram requires a Business or Creator account linked to a Facebook Page. You will authorize through the Meta Business Suite.",
    docsLink: "https://developers.facebook.com/docs/instagram-api/getting-started",
    videoLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  },
  Facebook: {
    title: "Facebook Integration Guide",
    quickHelp: "Connect your Facebook Pages to ImaGenie. You must be an administrator of the Page you want to connect.",
    docsLink: "https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow",
    videoLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  },
  Threads: {
    title: "Threads Integration Guide",
    quickHelp: "Threads integration allows you to share updates directly to your Threads profile. Authorize via your Instagram/Threads account.",
    docsLink: "https://developers.facebook.com/docs/threads",
    videoLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  },
  Gemini: {
    title: "Gemini API Setup Guide",
    quickHelp: "To use ImaGenie, you need a Google Gemini API Key. You can get one for free at Google AI Studio. Multiple keys help avoid rate limits and handle more concurrent content generation.",
    docsLink: "https://aistudio.google.com/app/apikey",
    videoLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
};

export function HelpModal({ platform, isOpen, onClose }: HelpModalProps) {
  const content = PLATFORM_HELP[platform];

  if (!content) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Info className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{content.title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quick Help</h4>
                  <p className="text-slate-600 leading-relaxed text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {content.quickHelp}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <a
                    href={content.docsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
                  >
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-all">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Documentation</p>
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        View Guide <ExternalLink className="w-3 h-3 opacity-40" />
                      </p>
                    </div>
                  </a>

                  <a
                    href={content.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl hover:border-amber-200 hover:bg-amber-50/50 transition-all group"
                  >
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 group-hover:scale-110 transition-all">
                      <Play className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Video Tutorial</p>
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        Watch Now <ExternalLink className="w-3 h-3 opacity-40" />
                      </p>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
