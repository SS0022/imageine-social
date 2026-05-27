import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Users, Mail, Calendar, FileText, Search, ExternalLink, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const postsSnap = await getDocs(collection(db, "posts"));
        
        setUsers(usersSnap.docs.map(d => ({ ...d.data(), id: d.id })));
        setPosts(postsSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      } catch (error) {
        console.error("Failed to fetch users list:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getUserPostCount = (userId: string) => {
    return posts.filter(p => p.userId === userId).length;
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.uid?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500">Directory of all users registered on the platform</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by email or UID..."
            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all w-full md:w-64"
          />
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Info</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{user.email || "Anonymous"}</span>
                          {user.email === "kumarsujit24@gmail.com" && (
                            <ShieldCheck className="w-3 h-3 text-red-500" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium font-mono">{user.uid}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-medium">
                        {(() => {
                          try {
                            const date = user.createdAt?.toDate?.() || new Date(user.createdAt);
                            if (isNaN(date.getTime())) return "N/A";
                            return format(date, "MMM d, yyyy");
                          } catch (e) {
                            return "N/A";
                          }
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">
                        <FileText className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{getUserPostCount(user.uid)} Posts</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-hover">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-400 font-medium">No users found matching your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
