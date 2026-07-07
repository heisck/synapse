'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookMarked,
  Plus,
  Search,
  Trash2,
  X,
  ArrowUpDown,
  Tag,
  FileText,
  Pencil,
  Type,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from './EmptyState';
import { useAppStore } from '@/stores/appStore';
import type { Note } from '@/types';

const PREDEFINED_TAGS = ['biology', 'cs', 'math', 'review', 'important', 'physics', 'chemistry', 'general'];

const TAG_COLORS: Record<string, string> = {
  biology: 'from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  cs: 'from-cyan-500/15 to-sky-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  math: 'from-violet-500/15 to-purple-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20',
  review: 'from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  important: 'from-rose-500/15 to-red-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  physics: 'from-blue-500/15 to-indigo-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20',
  chemistry: 'from-pink-500/15 to-fuchsia-500/15 text-pink-700 dark:text-pink-300 border-pink-500/20',
  general: 'from-slate-500/15 to-gray-500/15 text-slate-600 dark:text-slate-300 border-slate-500/20',
};

const springConfig = { type: 'spring' as const, stiffness: 400, damping: 30 };

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

  const cardVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2, ease: 'easeIn' } },
  };

type SortMode = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export function NotesView() {
  const { notes, addNote, updateNote, deleteNote } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);

  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      result = result.filter((n) =>
        selectedTags.every((tag) => n.tags.includes(tag))
      );
    }

    // Sort
    switch (sortMode) {
      case 'newest':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'title-asc':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return result;
  }, [notes, searchQuery, selectedTags, sortMode]);

  const handleCreateNote = () => {
    if (!newTitle.trim() && !newContent.trim()) return;
    const now = new Date().toISOString();
    const note: Note = {
      id: `note-${Date.now()}`,
      title: newTitle.trim() || 'Untitled Note',
      content: newContent.trim(),
      createdAt: now,
      updatedAt: now,
      tags: newTags,
    };
    addNote(note);
    setNewTitle('');
    setNewContent('');
    setNewTags([]);
    setIsCreating(false);
  };

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags([...note.tags]);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      updateNote(editingId, {
        title: editTitle.trim() || 'Untitled Note',
        content: editContent.trim(),
        tags: editTags,
      });
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditTags([]);
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) {
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
      setEditTags([]);
    }
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleTagOnNote = (tag: string, isEditing: boolean) => {
    if (isEditing) {
      setEditTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    } else {
      setNewTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    }
  };

  const cycleSortMode = () => {
    const modes: SortMode[] = ['newest', 'oldest', 'title-asc', 'title-desc'];
    const current = modes.indexOf(sortMode);
    setSortMode(modes[(current + 1) % modes.length]);
  };

  const sortLabel = () => {
    switch (sortMode) {
      case 'newest': return 'Newest first';
      case 'oldest': return 'Oldest first';
      case 'title-asc': return 'Title A-Z';
      case 'title-desc': return 'Title Z-A';
    }
  };

  const activeFilterCount = selectedTags.length + (searchQuery.trim() ? 1 : 0);

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4"
    >
      {/* Gradient header */}
      <motion.div variants={fadeUp} className="rounded-xl p-6 mesh-gradient gradient-border relative overflow-hidden pl-14 lg:pl-0">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Notes</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} total
              {activeFilterCount > 0 && ` -- showing ${filteredNotes.length}`}
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button onClick={() => setIsCreating(true)} size="sm" className="glow-emerald">
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Create New Note Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0, scale: 0.97 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, opacity: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-5 space-y-4 glow-emerald gradient-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">New Note</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle('');
                    setNewContent('');
                    setNewTags([]);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Note title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
              />
              <Textarea
                placeholder="Write your note here..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[120px] resize-y"
              />
              {/* Animated word count */}
              <div className="flex items-center justify-between">
                <div className="space-y-2 flex-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PREDEFINED_TAGS.map((tag) => (
                      <motion.button
                        key={tag}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleTagOnNote(tag, false)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                          newTags.includes(tag)
                            ? `bg-gradient-to-r ${TAG_COLORS[tag] || TAG_COLORS['general']}`
                            : 'bg-background/60 border-border hover:bg-accent'
                        }`}
                      >
                        {tag}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <motion.span
                  key={newContent.length}
                  initial={{ scale: 1.1, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-xs text-muted-foreground flex items-center gap-1 self-end"
                >
                  <Type className="h-3 w-3" />
                  {newContent.trim().split(/\s+/).filter(Boolean).length} words
                </motion.span>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle('');
                    setNewContent('');
                    setNewTags([]);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateNote}>
                  Save Note
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filters */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={cycleSortMode}
            className="w-full sm:w-auto shrink-0"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {sortLabel()}
          </Button>
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_TAGS.map((tag) => (
            <motion.button
              key={tag}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleTagFilter(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                selectedTags.includes(tag)
                  ? `bg-gradient-to-r ${TAG_COLORS[tag] || TAG_COLORS['general']}`
                  : 'bg-background/60 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {tag}
            </motion.button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </motion.div>

      {/* Notes List */}
      {filteredNotes.length === 0 && notes.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={BookMarked}
            title="No notes yet"
            description="Create your first note to start capturing ideas, summaries, and study notes."
            actionLabel="Create Note"
            onAction={() => setIsCreating(true)}
          />
        </motion.div>
      ) : filteredNotes.length === 0 ? (
        <motion.div variants={fadeUp} className="text-center py-12">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes match your search or filters.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTags([]);
            }}
            className="text-sm text-primary hover:underline mt-1"
          >
            Clear all filters
          </button>
        </motion.div>
      ) : (
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid gap-3"
        >
          <AnimatePresence mode="popLayout">
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                layout
                className={`glass rounded-xl noise transition-shadow hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 ${
                  expandedId === note.id ? 'ring-1 ring-primary/20 glow-emerald' : ''
                }`}
              >
                {editingId === note.id ? (
                  /* Edit Mode */
                  <div className="p-4 space-y-4">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Note title..."
                      autoFocus
                    />
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[120px] resize-y"
                      placeholder="Note content..."
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {PREDEFINED_TAGS.map((tag) => (
                          <motion.button
                            key={tag}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleTagOnNote(tag, true)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              editTags.includes(tag)
                                ? `bg-gradient-to-r ${TAG_COLORS[tag] || TAG_COLORS['general']}`
                                : 'bg-background/60 border-border hover:bg-accent'
                            }`}
                          >
                            {tag}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <div
                    className="cursor-pointer p-4"
                    onClick={() =>
                      setExpandedId((prev) => (prev === note.id ? null : note.id))
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{note.title}</h3>
                        {note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {note.tags.map((tag) => (
                              <motion.span
                                key={tag}
                                whileHover={{ scale: 1.1 }}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border bg-gradient-to-r ${TAG_COLORS[tag] || TAG_COLORS['general']}`}
                              >
                                {tag}
                              </motion.span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                          {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(note);
                          }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedId === note.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {note.content || 'No content'}
                            </p>
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-muted-foreground sm:hidden">
                                  {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Updated {format(new Date(note.updatedAt), 'h:mm a')}
                                </span>
                              </div>
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] text-muted-foreground flex items-center gap-1"
                              >
                                <Type className="h-3 w-3" />
                                {note.content.trim().split(/\s+/).filter(Boolean).length} words
                              </motion.span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}