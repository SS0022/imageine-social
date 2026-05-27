import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Users, FileText, Activity, UserPlus, ArrowUpRight, TrendingUp } from "lucide-react";
import { format, subDays, isAfter, startOfDay, eachDayOfInterval } from "date-fns";

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    activeToday: 0,
    newUsersWeek: 0,
    returningUsers: 0,
    dailyPostTrend: [] as any[],
    platformDist: [] as any[]
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const postsSnap = await getDocs(collection(db, "posts"));

        const users = usersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const posts = postsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

        const now = new Date();
        const today = startOfDay(now);
        const last7Days = subDays(now, 7);

        // Basic Counts
        const totalUsers = users.length;
        const totalPosts = posts.length;

        // New Users (Last 7 days)
        const newUsersWeek = users.filter((u: any) => {
          const createdAt = u.createdAt?.toDate?.() || new Date(u.createdAt);
          return isAfter(createdAt, last7Days);
        }).length;

        // Active Today (users who created a post today)
        const activeUsersToday = new Set(
          posts
            .filter((p: any) => {
              const createdAt = p.createdAt?.toDate?.() || new Date(p.createdAt);
              return isAfter(createdAt, today);
            })
            .map((p: any) => p.userId)
        ).size;

        // Returning Users (users with more than 1 post)
        const userPostCounts: Record<string, number> = {};
        posts.forEach((p: any) => {
          userPostCounts[p.userId] = (userPostCounts[p.userId] || 0) + 1;
        });
        const returningUsers = Object.values(userPostCounts).filter(count => count > 1).length;

        // Daily Post Trend (Last 14 days)
        const last14Days = subDays(now, 14);
        const dailyInterval = eachDayOfInterval({ start: last14Days, end: now });
        const postTrend = dailyInterval.map(day => {
          const dayStr = format(day, "MMM dd");
          const count = posts.filter((p: any) => {
            let createdAt;
            try {
              createdAt = p.createdAt?.toDate?.() || new Date(p.createdAt);
              if (isNaN(createdAt.getTime())) return false;
              return format(createdAt, "MMM dd") === dayStr;
            } catch (e) {
              return false;
            }
          }).length;
          return { name: dayStr, posts: count };
        });

        // Platform Distribution
        const platformCounts: Record<string, number> = {};
        posts.forEach((p: any) => {
          platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
        });
        const platformDist = Object.entries(platformCounts).map(([name, value]) => ({ name, value }));

        setStats({
          totalUsers,
          totalPosts,
          activeToday: activeUsersToday,
          newUsersWeek,
          returningUsers,
          dailyPostTrend: postTrend,
          platformDist
        });
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#a5b4fc', '#6366f1'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold text-slate-900">Platform Analytics</h2>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100">
          <Activity className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Live View</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" 
          value={stats.totalUsers} 
          icon={<Users className="w-5 h-5 text-blue-600" />} 
          subText={`${stats.newUsersWeek} new this week`}
          trend={12}
        />
        <StatCard 
          title="Total Posts" 
          value={stats.totalPosts} 
          icon={<FileText className="w-5 h-5 text-indigo-600" />} 
          subText="All time generation"
          trend={8}
        />
        <StatCard 
          title="Active Now" 
          value={stats.activeToday} 
          icon={<Activity className="w-5 h-5 text-green-600" />} 
          subText="Users active today"
          trend={15}
        />
        <StatCard 
          title="Returning" 
          value={stats.returningUsers} 
          icon={<UserPlus className="w-5 h-5 text-purple-600" />} 
          subText={`${((stats.returningUsers / stats.totalUsers) * 100).toFixed(1)}% retention`}
          trend={5}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-8 rounded-[2rem] border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-display font-bold text-slate-900">Post Creation Trend</h3>
              <p className="text-xs text-slate-500 mt-1">Daily generation activity over last 14 days</p>
            </div>
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyPostTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="posts" 
                  stroke="#4f46e5" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[2rem] border border-slate-200">
          <h3 className="font-display font-bold text-slate-900 mb-8">Platform Usage</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.platformDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.platformDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {stats.platformDist.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium text-slate-600">{p.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-900">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subText, trend }: { title: string, value: number, icon: React.ReactNode, subText: string, trend: number }) {
  return (
    <div className="glass-panel p-6 rounded-[2rem] border border-slate-200 hover:shadow-lg transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-white transition-colors">
          {icon}
        </div>
        <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">
          <ArrowUpRight className="w-3 h-3" />
          <span className="text-[10px] font-bold">+{trend}%</span>
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</h4>
        <div className="text-3xl font-display font-black text-slate-900 mb-2">{value.toLocaleString()}</div>
        <p className="text-[11px] text-slate-500 font-medium">{subText}</p>
      </div>
    </div>
  );
}
