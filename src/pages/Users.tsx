import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users as UsersIcon, Plus, Search, Edit2, Trash2, CheckCircle, 
  XCircle, AlertCircle, RefreshCw, Mail, Shield, Calendar, 
  UserPlus, Activity, Building2, ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// ── Canonical roles — matches backend MemberRole enum ──────────────────────

const CANONICAL_ROLES = ['viewer', 'editor', 'admin', 'owner'] as const;
type CanonicalRole = typeof CANONICAL_ROLES[number];

const ROLE_DISPLAY: Record<CanonicalRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  admin:  'Administrator',
  owner:  'Owner',
};

const ROLE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  owner:  { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30' },
  admin:  { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  editor: { color: 'text-brand-primary', bg: 'bg-brand-primary/10', border: 'border-brand-primary/30' },
  viewer: { color: 'text-zinc-400',  bg: 'bg-zinc-500/10',  border: 'border-zinc-500/30' },
};

const ROLE_FILTERS = ['All', ...CANONICAL_ROLES];

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkspaceUser {
  id: string;
  user_id: string;      // email
  role: CanonicalRole;
  invited_at?: string;
  accepted_at?: string;
  workspace_id?: string;
}

// ── Avatar component ───────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (name || '?')[0].toUpperCase();
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  const colors = ['from-violet-500 to-purple-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 
                  'from-blue-500 to-cyan-600', 'from-pink-500 to-rose-600', 'from-indigo-500 to-blue-600'];
  const gradient = colors[name.charCodeAt(0) % colors.length];
  
  return (
    <div className={cn(
      'rounded-xl bg-gradient-to-br flex items-center justify-center font-bold text-white flex-shrink-0 ring-2 ring-white/5',
      gradient, sizeClass
    )}>
      {initials}
    </div>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-4 py-3.5 border-b border-brand-border/30 animate-pulse">
    <div className="w-10 h-10 rounded-xl bg-brand-elevated" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-32 bg-brand-elevated rounded" />
      <div className="h-2.5 w-48 bg-brand-elevated rounded" />
    </div>
    <div className="h-6 w-20 bg-brand-elevated rounded-full" />
    <div className="h-4 w-24 bg-brand-elevated rounded" />
    <div className="h-8 w-16 bg-brand-elevated rounded-lg" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function Users() {
  const { restEndpoint, selectedWorkspaceId, masterToken } = useStore();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CanonicalRole>('viewer');
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'user_id' | 'role' | 'invited_at'>('user_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const base = restEndpoint.replace(/\/+$/, '');
  const workspaceId = selectedWorkspaceId || 'default';

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (masterToken) authHeaders['Authorization'] = `Bearer ${masterToken}`;

  // ── Fetch users from the workspace ───────────────────────────────────────

  const fetchUsers = async () => {
    if (!base) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/workspaces/${workspaceId}/users`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else if (res.status === 404) {
        setUsers([]);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || `Failed to load users (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [restEndpoint, workspaceId]);

  // ── Filtered + sorted users ──────────────────────────────────────────────

  const processedUsers = useMemo(() => {
    let result = [...users];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.user_id.toLowerCase().includes(q));
    }

    if (selectedRole !== 'All') {
      result = result.filter(u => u.role === selectedRole);
    }

    result.sort((a, b) => {
      const aVal = (a[sortBy] || '').toString().toLowerCase();
      const bVal = (b[sortBy] || '').toString().toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    return result;
  }, [users, searchQuery, selectedRole, sortBy, sortDir]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    editors: users.filter(u => u.role === 'editor').length,
    viewers: users.filter(u => u.role === 'viewer').length,
    owners: users.filter(u => u.role === 'owner').length,
  }), [users]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${base}/workspaces/${workspaceId}/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ email: email.trim(), role, workspace_id: workspaceId }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`User ${email.trim()} added as ${ROLE_DISPLAY[role]}`);
        setEmail(''); setRole('viewer'); setShowAddForm(false);
        fetchUsers();
      } else if (res.status === 409) {
        toast.error('User is already a member of this workspace');
      } else {
        toast.error(d.error || 'Failed to add user');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: CanonicalRole) => {
    const oldUser = users.find(u => u.id === userId);
    if (!oldUser) return;

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

    try {
      const res = await fetch(`${base}/workspaces/${workspaceId}/users/${userId}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success(`Role updated to ${ROLE_DISPLAY[newRole]}`);
      } else {
        // Revert
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: oldUser.role } : u));
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Failed to update role');
      }
    } catch (err: any) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: oldUser.role } : u));
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // Optimistic removal
    setUsers(prev => prev.filter(u => u.id !== userId));
    setSelectedUsers(prev => { const next = new Set(prev); next.delete(userId); return next; });

    try {
      const res = await fetch(`${base}/workspaces/${workspaceId}/users/${userId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        toast.success(`${userEmail} removed from workspace`);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Failed to remove user');
        fetchUsers();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove user');
      fetchUsers();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    const ids = Array.from(selectedUsers);
    setUsers(prev => prev.filter(u => !selectedUsers.has(u.id)));
    setSelectedUsers(new Set());

    try {
      const results = await Promise.allSettled(
        ids.map(id => fetch(`${base}/workspaces/${workspaceId}/users/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        }))
      );
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
      if (failed > 0) {
        toast.error(`${failed} of ${ids.length} deletions failed — refreshing`);
        fetchUsers();
      } else {
        toast.success(`${ids.length} users removed`);
      }
    } catch (err: any) {
      toast.error('Bulk delete failed — refreshing');
      fetchUsers();
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === processedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(processedUsers.map(u => u.id)));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20 md:pb-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <UsersIcon className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Users</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} total · {stats.admins} admins · {stats.editors} editors · {stats.viewers} viewers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers} className="p-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {selectedUsers.size > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 text-xs font-bold font-mono uppercase tracking-wider transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove ({selectedUsers.size})
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary"
          >
            <UserPlus className="w-4 h-4" />
            {showAddForm ? 'Cancel' : 'Add User'}
          </motion.button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, icon: UsersIcon, color: 'text-brand-primary' },
          { label: 'Owners', value: stats.owners, icon: Shield, color: 'text-red-400' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-amber-400' },
          { label: 'Editors', value: stats.editors, icon: Activity, color: 'text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5 hover:border-brand-border transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider">{stat.label}</span>
              <stat.icon className={cn('w-3 h-3', stat.color)} />
            </div>
            <div className={cn('text-sm font-mono font-bold', stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Add User Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddUser}
            className="p-5 bg-brand-surface/80 backdrop-blur-sm border border-brand-border/50 rounded-2xl space-y-4 overflow-hidden"
          >
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-brand-text flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-brand-primary" /> Add to Workspace
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Email</label>
                <input
                  type="email" placeholder="user@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Role</label>
                <select value={role} onChange={e => setRole(e.target.value as CanonicalRole)}
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary transition-all">
                  {CANONICAL_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_DISPLAY[r]}</option>
                  ))}
                </select>
                <p className="text-[9px] text-brand-text-muted font-mono mt-1">
                  {role === 'owner' && 'Full access including deletion'}
                  {role === 'admin' && 'Can manage users and settings'}
                  {role === 'editor' && 'Can create and publish content'}
                  {role === 'viewer' && 'Read-only access'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold shadow-glow-primary disabled:opacity-50 transition-all">
                {saving ? 'Adding…' : 'Add to Workspace'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input
            type="text" placeholder="Search by email..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-all"
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {ROLE_FILTERS.map(r => (
            <button key={r} onClick={() => setSelectedRole(r)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
                selectedRole === r ? 'bg-brand-primary text-white shadow-glow-primary' : 'text-brand-text-muted hover:text-white'
              )}>
              {r === 'All' ? 'All' : ROLE_DISPLAY[r as CanonicalRole]}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-brand-border/50 bg-brand-elevated/20 text-[10px] font-bold text-brand-text-muted uppercase tracking-widest">
          <input
            type="checkbox"
            checked={selectedUsers.size === processedUsers.length && processedUsers.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-brand-border bg-brand-elevated accent-brand-primary"
          />
          <div className="flex-1">User</div>
          <div className="w-28">Role</div>
          <div className="w-32 hidden md:block">Invited</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        <div className="divide-y divide-brand-border/30">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : error ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
              <p className="text-sm text-brand-text-muted font-mono">{error}</p>
              <button onClick={fetchUsers} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
            </div>
          ) : processedUsers.length === 0 ? (
            <div className="py-16 text-center">
              <UsersIcon className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-brand-text-muted font-mono">
                {users.length === 0 ? 'No users in this workspace.' : 'No users match your filters.'}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {processedUsers.map((user, idx) => {
                const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.viewer;
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-brand-elevated/20 transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => {
                        setSelectedUsers(prev => {
                          const next = new Set(prev);
                          next.has(user.id) ? next.delete(user.id) : next.add(user.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-brand-border bg-brand-elevated accent-brand-primary"
                    />
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <Avatar name={user.user_id} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                          <Mail className="w-3 h-3 flex-shrink-0 text-brand-text-muted" /> {user.user_id}
                        </p>
                      </div>
                    </div>
                    <div className="w-28">
                      <select
                        value={user.role}
                        onChange={e => handleUpdateRole(user.id, e.target.value as CanonicalRole)}
                        onClick={e => e.stopPropagation()}
                        className={cn(
                          'px-2 py-1 rounded-full text-[10px] font-bold font-mono uppercase border cursor-pointer transition-all',
                          roleConfig.bg, roleConfig.color, roleConfig.border,
                        )}>
                        {CANONICAL_ROLES.map(r => (
                          <option key={r} value={r} className="bg-brand-surface text-brand-text">{ROLE_DISPLAY[r]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32 hidden md:flex items-center gap-1.5 text-xs text-brand-text-muted font-mono">
                      <Calendar className="w-3 h-3" />
                      {user.invited_at ? new Date(user.invited_at).toLocaleDateString() : '—'}
                    </div>
                    <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.user_id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-text-muted hover:text-red-400 transition-colors"
                        title="Remove from workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-brand-border/50 bg-brand-elevated/10 flex items-center justify-between">
          <span className="text-[10px] text-brand-text-muted font-mono">
            {processedUsers.length} of {users.length} users · Workspace: {workspaceId}
          </span>
          <span className="text-[10px] text-brand-text-muted font-mono">
            {selectedUsers.size > 0 ? `${selectedUsers.size} selected` : ''}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
