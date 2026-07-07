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
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from './EmptyState';
import { useAppStore } from '@/stores/appStore';
import type { Note } from '@/types';

const PREDEFINED_TAGS = ['biology', 'cs', 'math', 'review', 'important', 'physics', 'chemistry', 'general'];

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
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pl-14 lg:pl-0">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground text-sm">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} total
            {activeFilterCount > 0 && ` - showing ${filteredNotes.length}`}
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </motion.div>

      {/* Create New Note Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">New Note</h3>
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
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PREDEFINED_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTagOnNote(tag, false)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        newTags.includes(tag)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background/60 border-border hover:bg-accent'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
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
            <button
              key={tag}
              onClick={() => toggleTagFilter(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedTags.includes(tag)
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-background/60 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {tag}
            </button>
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
                className={`glass rounded-xl transition-shadow hover:shadow-md ${
                  expandedId === note.id ? 'ring-1 ring-primary/20' : ''
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
                          <button
                            key={tag}
                            onClick={() => toggleTagOnNote(tag, true)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              editTags.includes(tag)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background/60 border-border hover:bg-accent'
                            }`}
                          >
                            {tag}
                          </button>
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
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {tag}
                              </Badge>
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
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {note.content || 'No content'}
                            </p>
                            <div className="flex items-center gap-3 mt-3">
                              <span className="text-[10px] text-muted-foreground sm:hidden">
                                {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Updated {format(new Date(note.updatedAt), 'h:mm a')}
                              </span>
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