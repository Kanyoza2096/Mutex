import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  CheckSquare, Plus, Trash2, ArrowRight, Clock, Users, RefreshCw, 
  AlertCircle, GripVertical, Filter, Search, Calendar, Flag,
  MoreHorizontal, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  dueDate: string;
}

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#64748b', icon: Clock },
  { id: 'in-progress', title: 'In Progress', color: '#818cf8', icon: Zap },
  { id: 'done', title: 'Done', color: '#34d399', icon: CheckSquare },
] as const;

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any>; label: string }> = {
  high:   { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30',   icon: Flag, label: 'High' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Flag, label: 'Medium' },
  low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: Flag, label: 'Low' },
};

// ── Skeleton card ──────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="p-4 bg-brand-elevated/50 rounded-xl border border-brand-border/30 animate-pulse space-y-3">
    <div className="h-4 w-3/4 bg-brand-elevated rounded" />
    <div className="flex gap-2">
      <div className="h-5 w-14 bg-brand-elevated rounded-full" />
      <div className="h-5 w-16 bg-brand-elevated rounded-full" />
    </div>
    <div className="flex justify-between">
      <div className="h-3 w-20 bg-brand-elevated rounded" />
      <div className="h-3 w-16 bg-brand-elevated rounded" />
    </div>
  </div>
);

// ── Task card component ────────────────────────────────────────────────────

function TaskCard({ task, onCycle, onDelete }: { 
  task: Task; 
  onCycle: (id: string, status: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const PriorityIcon = priorityConfig.icon;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: -20 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="p-4 bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 rounded-xl transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden"
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Title */}
      <h3 className="text-sm font-bold text-white mb-3 pr-6 leading-snug">{task.title}</h3>

      {/* Priority + Status badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border',
          priorityConfig.bg, priorityConfig.color, priorityConfig.border
        )}>
          <PriorityIcon className="w-3 h-3" />
          {priorityConfig.label}
        </span>
        {isOverdue && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertCircle className="w-3 h-3" />
            Overdue
          </span>
        )}
      </div>

      {/* Meta: Assignee + Due Date */}
      <div className="flex items-center justify-between text-[10px] text-brand-text-muted font-mono mb-3">
        <span className="flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          {task.assignee}
        </span>
        <span className={cn(
          'flex items-center gap-1.5',
          isOverdue && 'text-red-400'
        )}>
          <Calendar className="w-3 h-3" />
          {task.dueDate}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onCycle(task.id, task.status)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border border-brand-primary/20 text-[10px] font-bold font-mono uppercase tracking-wider transition-all"
        >
          <ArrowRight className="w-3 h-3" />
          {task.status === 'todo' ? 'Start' : task.status === 'in-progress' ? 'Complete' : 'Reopen'}
        </button>
        <button
          onClick={() => onDelete(task.id, task.title)}
          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function Tasks() {
  const { restEndpoint, masterToken } = useStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [newTask, setNewTask] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/tasks`, { headers });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [restEndpoint]);

  // ── Filtered tasks ───────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }
    return result;
  }, [tasks, searchQuery, priorityFilter]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length,
  }), [tasks]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTask.trim()) {
      toast.error('Task title cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const task: Task = {
        id: Date.now().toString(),
        title: newTask.trim(),
        status: 'todo',
        priority: taskPriority as Task['priority'],
        assignee: 'Administrator',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      };
      setTasks(prev => [task, ...prev]);
      setNewTask('');
      toast.success('Task added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, title: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    toast.success(`"${title}" removed`);
  };

  const handleCycleStatus = (id: string, currentStatus: string) => {
    const sequence = ['todo', 'in-progress', 'done'];
    const nextIdx = (sequence.indexOf(currentStatus) + 1) % 3;
    const nextStatus = sequence[nextIdx];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus as Task['status'] } : t));
    const colTitle = COLUMNS.find(c => c.id === nextStatus)?.title || nextStatus;
    toast.info(`Moved to ${colTitle}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20 md:pb-0 h-full flex flex-col">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <CheckSquare className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Task Board</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} tasks · {stats.todo} todo · {stats.inProgress} in progress · {stats.done} done
              {stats.overdue > 0 && <span className="text-red-400 ml-1">· {stats.overdue} overdue</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchTasks} className="p-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <form onSubmit={handleAddTask} className="flex items-center gap-2">
            <input
              type="text" placeholder="New task..." value={newTask}
              onChange={e => setNewTask(e.target.value)}
              className="px-3.5 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-all w-48"
            />
            <select
              value={taskPriority} onChange={e => setTaskPriority(e.target.value)}
              className="px-3 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </motion.button>
          </form>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2 shrink-0">
        {[
          { label: 'All', value: stats.total, color: 'text-brand-primary' },
          { label: 'To Do', value: stats.todo, color: 'text-zinc-400' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-violet-400' },
          { label: 'Done', value: stats.done, color: 'text-emerald-400' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5 hover:border-brand-border transition-colors">
            <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider">{stat.label}</span>
            <div className={cn('text-sm font-mono font-bold mt-0.5', stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input
            type="text" placeholder="Search tasks..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 transition-all"
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {['all', 'high', 'medium', 'low'].map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
                priorityFilter === p ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white'
              )}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1">
          {[1,2,3].map(i => (
            <div key={i} className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4 space-y-3">
              <div className="h-6 bg-brand-elevated rounded w-24" />
              {[1,2,3].map(j => <SkeletonCard key={j} />)}
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
            <p className="text-sm text-brand-text-muted font-mono">{error}</p>
            <button onClick={fetchTasks} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {COLUMNS.map((column, colIdx) => {
              const columnTasks = filteredTasks.filter(t => t.status === column.id);
              const ColumnIcon = column.icon;
              
              return (
                <motion.div
                  key={column.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: colIdx * 0.08 }}
                  className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-4 flex flex-col min-h-0"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                      <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text">{column.title}</h2>
                      <span className="bg-brand-elevated px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold text-brand-text-muted">
                        {columnTasks.length}
                      </span>
                    </div>
                    <ColumnIcon className="w-4 h-4 text-brand-text-muted/50" />
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                    {columnTasks.map((task, idx) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onCycle={handleCycleStatus}
                        onDelete={handleDelete}
                      />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-brand-border/50 rounded-xl text-brand-text-muted">
                        <ColumnIcon className="w-6 h-6 mb-2 opacity-30" />
                        <span className="text-[10px] font-mono uppercase tracking-wider">No tasks</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
