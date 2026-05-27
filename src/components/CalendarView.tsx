import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, ChevronRight, Twitter, Linkedin, Instagram, Facebook, MessageCircle, Info } from 'lucide-react';
import { useState } from 'react';

interface ScheduledPost {
  id: string;
  platform: string;
  scheduledAt: string;
  status: string;
  content: string;
  hashtags: string[];
  imageData?: string;
}

interface CalendarViewProps {
  posts: ScheduledPost[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onPostClick?: (post: ScheduledPost) => void;
}

export const CalendarView = ({ posts, selectedDate, onDateChange, onPostClick }: CalendarViewProps) => {
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dayPosts = posts.filter(post => post.scheduledAt && isSameDay(new Date(post.scheduledAt), date));
      if (dayPosts.length > 0) {
        return (
          <div className="flex flex-wrap gap-1 justify-center mt-1">
            {dayPosts.map((post, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full ${post.status === 'published' ? 'bg-indigo-500' : post.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'}`} 
                title={`${post.platform} - ${post.status}`}
              />
            ))}
          </div>
        );
      }
    }
    return null;
  };

  const selectedDayPosts = posts.filter(post => post.scheduledAt && isSameDay(new Date(post.scheduledAt), selectedDate));

  const getIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "twitter":
      case "x":
        return <Twitter className="w-4 h-4 text-sky-500" />;
      case "linkedin":
        return <Linkedin className="w-4 h-4 text-blue-700" />;
      case "instagram":
        return <Instagram className="w-4 h-4 text-pink-600" />;
      case "facebook":
        return <Facebook className="w-4 h-4 text-blue-600" />;
      case "threads":
        return <MessageCircle className="w-4 h-4 text-black" />;
      default:
        return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      <div className="lg:col-span-2 glass-panel p-6 rounded-2xl shadow-xl">
        <style>{`
          .react-calendar {
            width: 100%;
            border: none;
            font-family: inherit;
            background: transparent;
          }
          .react-calendar__tile--active {
            background: #6366f1 !important;
            border-radius: 8px;
            color: white;
          }
          .react-calendar__tile--now {
            background: #f1f5f9;
            border-radius: 8px;
          }
          .react-calendar__navigation button:enabled:hover,
          .react-calendar__navigation button:enabled:focus {
            background-color: #f8fafc;
            border-radius: 8px;
          }
          .react-calendar__tile:enabled:hover,
          .react-calendar__tile:enabled:focus {
            background-color: #f1f5f9;
            border-radius: 8px;
          }
          .react-calendar__month-view__days__day--neighboringMonth {
            opacity: 0.3;
          }
        `}</style>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold">Content Calendar</h3>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Info className="w-3 h-3" />
            <span>Select a date to view posts</span>
          </div>
        </div>
        <Calendar 
          onChange={(val) => onDateChange(val as Date)}
          value={selectedDate}
          tileContent={tileContent}
          className="rounded-xl"
        />
        <div className="mt-6 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-slate-500">Published</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-slate-500">Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">Pending</span>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-slate-200">
        <h4 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          Posts for {format(selectedDate, "MMM d, yyyy")}
        </h4>
        
        <div className="space-y-4">
          {selectedDayPosts.length > 0 ? (
            selectedDayPosts.map((post) => (
              <motion.button
                layoutId={post.id}
                key={post.id}
                onClick={() => onPostClick?.(post)}
                className="w-full text-left p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:bg-white hover:shadow-lg transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getIcon(post.platform)}
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{post.platform}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                  {post.content}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400">
                    {format(new Date(post.scheduledAt), "h:mm a")}
                  </span>
                  <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                    post.status === 'published' ? 'bg-indigo-100 text-indigo-700' : 
                    post.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {post.status}
                  </div>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="text-center py-20">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <CalendarIcon className="w-6 h-6 text-slate-200" />
              </div>
              <p className="text-xs text-slate-400 font-medium italic">No posts scheduled for this day</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
