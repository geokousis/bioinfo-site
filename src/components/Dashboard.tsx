import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Image as ImageIcon,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X
} from 'lucide-react';

import type {
  AnnouncementItem,
  CardDetail,
  ContactCard,
  Course,
  DeadlineCard,
  FacultyMember,
  FormField,
  Highlight,
  LocaleCode,
  LocaleContent,
  ResearchArea,
  Requirement,
  SiteContent,
  Statistic
} from '../types';
import { iconOptions } from '../icons';
import { deleteSiteAsset, uploadSiteAsset, saveContentBackup, fetchContentBackups, restoreContentBackup, type ContentBackup } from '../lib/contentService';
import { LanguageSwitch } from './LanguageSwitch';
import { RichTextEditor } from './RichTextEditor';

type DashboardProps = {
  content: SiteContent;
  onSave: (next: SiteContent) => Promise<void>;
  onSignOut: () => void;
  onForceSync: () => Promise<void>;
  activeLocale: LocaleCode;
  onChangeLocale: (locale: LocaleCode) => void;
};

const CLONE = <T,>(data: T): T => JSON.parse(JSON.stringify(data));
const MAX_HISTORY = 20;

const deepEqual = (a: SiteContent, b: SiteContent) => JSON.stringify(a) === JSON.stringify(b);

export function Dashboard({ content, onSave, onSignOut, onForceSync, activeLocale, onChangeLocale }: DashboardProps) {
  const [workingContent, setWorkingContent] = useState<SiteContent>(() => CLONE(content));
  const [undoStack, setUndoStack] = useState<SiteContent[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backups, setBackups] = useState<ContentBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState<number | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Track the last synced content from props to detect external changes
  const lastSyncedContentRef = useRef<string>(JSON.stringify(content));
  const isFirstMount = useRef(true);

  // Only sync from prop when content actually changes from external source
  useEffect(() => {
    const contentStr = JSON.stringify(content);

    // Skip on first mount - we already initialized with content
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    // Only sync if content prop actually changed from what we last synced
    if (contentStr !== lastSyncedContentRef.current) {
      // Only reset if user hasn't made changes
      if (!isDirty) {
        setWorkingContent(CLONE(content));
        setUndoStack([]);
        setSaveError(null);
        setIsSaving(false);
      }
      lastSyncedContentRef.current = contentStr;
    }
  }, [content, isDirty]);

  useEffect(() => {
    const hasChanges = JSON.stringify(workingContent) !== lastSyncedContentRef.current;
    setIsDirty(hasChanges);
  }, [workingContent]);

  const localeContent = workingContent[activeLocale];
  const inputClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900';
  const textareaClass = 'w-full rounded border border-gray-300 px-3 py-2 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900';

  if (!localeContent) {
    return null;
  }

  const applyUpdate = (mutator: (draft: SiteContent) => void) => {
    setWorkingContent((prev) => {
      const prevClone = CLONE(prev);
      const next = CLONE(prev);
      mutator(next);
      if (deepEqual(prev, next)) {
        return prev;
      }
      setUndoStack((stack) => {
        const updatedStack = [...stack, prevClone];
        return updatedStack.length > MAX_HISTORY ? updatedStack.slice(updatedStack.length - MAX_HISTORY) : updatedStack;
      });
      return next;
    });
  };

  const updateLocaleContent = (localeKey: LocaleCode, updater: (locale: LocaleContent) => LocaleContent) => {
    applyUpdate((draft) => {
      draft[localeKey] = updater(CLONE(draft[localeKey]));
    });
  };

  const updateActiveLocale = (updater: (locale: LocaleContent) => LocaleContent) => {
    updateLocaleContent(activeLocale, updater);
  };

  const canUndo = undoStack.length > 0;

  const handleUndo = () => {
    if (!canUndo) {
      return;
    }
    setUndoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const previousState = CLONE(stack[stack.length - 1]);
      setWorkingContent(previousState);
      return stack.slice(0, -1);
    });
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(CLONE(workingContent));
      lastSyncedContentRef.current = JSON.stringify(workingContent);
      setUndoStack([]);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save content', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSaveError(null);
    try {
      await onForceSync();
      // Reset working content after sync - the content prop will update
      setUndoStack([]);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to sync from Supabase', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to sync from database');
    } finally {
      setIsSyncing(false);
    }
  };

  const openBackupModal = async () => {
    setShowBackupModal(true);
    setLoadingBackups(true);
    try {
      const fetchedBackups = await fetchContentBackups();
      setBackups(fetchedBackups);
    } catch (error) {
      console.error('Failed to fetch backups', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async (fromModal = false) => {
    setCreatingBackup(true);
    try {
      await saveContentBackup(workingContent);
      if (fromModal || showBackupModal) {
        const fetchedBackups = await fetchContentBackups();
        setBackups(fetchedBackups);
      }
    } catch (error) {
      console.error('Failed to create backup', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to create backup');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: number) => {
    setRestoringBackup(backupId);
    try {
      const restoredContent = await restoreContentBackup(backupId);
      if (restoredContent) {
        setWorkingContent(restoredContent);
        setShowBackupModal(false);
        setUndoStack([]);
      }
    } catch (error) {
      console.error('Failed to restore backup', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to restore backup');
    } finally {
      setRestoringBackup(null);
    }
  };

  const undoButtonClass = useMemo(
    () =>
      canUndo
        ? 'inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100'
        : 'inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-400 cursor-not-allowed',
    [canUndo],
  );

  const saveButtonClass = useMemo(
    () =>
      isDirty && !isSaving
        ? 'inline-flex items-center justify-center gap-2 rounded-full border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800'
        : 'inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-400 cursor-not-allowed',
    [isDirty, isSaving],
  );

  const addNavLink = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      navLinks: [...(locale.navLinks ?? []), { label: 'New Link', target: '#section' }],
    }));
  };

  const updateNavLink = (index: number, field: 'label' | 'target', value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      navLinks: (locale.navLinks ?? []).map((link, idx) => (idx === index ? { ...link, [field]: value } : link)),
    }));
  };

  const removeNavLink = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      navLinks: (locale.navLinks ?? []).filter((_, idx) => idx !== index),
    }));
  };

  const moveNavLink = (index: number, direction: 'up' | 'down') => {
    updateActiveLocale((locale) => {
      const links = [...(locale.navLinks ?? [])];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= links.length) return locale;
      [links[index], links[newIndex]] = [links[newIndex], links[index]];
      return { ...locale, navLinks: links };
    });
  };

  const updateHeroBadgeLink = (field: 'href' | 'ariaLabel', value: string) => {
    updateActiveLocale((locale) => {
      const current = locale.hero.clickTarget ?? { href: '', ariaLabel: '' };
      const next = {
        ...current,
        [field]: value,
      };

      const trimmedHref = next.href.trim();
      const trimmedLabel = (next.ariaLabel ?? '').trim();

      if (!trimmedHref && !trimmedLabel) {
        const { clickTarget: _unused, ...restHero } = locale.hero;
        return {
          ...locale,
          hero: {
            ...restHero,
          },
        };
      }

      return {
        ...locale,
        hero: {
          ...locale.hero,
          clickTarget: {
            href: trimmedHref,
            ariaLabel: trimmedLabel || undefined,
          },
        },
      };
    });
  };

  const addStat = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      stats: [...locale.stats, { value: '0', label: 'New Metric' }],
    }));
  };

  const updateStat = (index: number, field: keyof Statistic, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      stats: locale.stats.map((stat, idx) => (idx === index ? { ...stat, [field]: value } : stat)),
    }));
  };

  const removeStat = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      stats: locale.stats.filter((_, idx) => idx !== index),
    }));
  };

  const addAnnouncement = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      announcements: {
        ...locale.announcements,
        items: [
          {
            id: `announcement-${Date.now()}`,
            title: 'New Announcement',
            date: 'Date',
            summary: 'Announcement summary goes here.',
            body: 'Full announcement body.',
            attachments: [],
          },
          ...locale.announcements.items,
        ],
      },
    }));
  };

  const updateAnnouncement = (index: number, field: keyof AnnouncementItem, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      announcements: {
        ...locale.announcements,
        items: locale.announcements.items.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const removeAnnouncement = (localeCode: LocaleCode, index: number) => {
    const announcement = workingContent[localeCode]?.announcements.items[index];
    const storagePaths = announcement?.attachments
      .map((attachment) => attachment.storagePath)
      .filter((path): path is string => Boolean(path)) ?? [];

    updateLocaleContent(localeCode, (locale) => ({
      ...locale,
      announcements: {
        ...locale.announcements,
        items: locale.announcements.items.filter((_, idx) => idx !== index),
      },
    }));

    storagePaths.forEach((path) => {
      void deleteSiteAsset(path);
    });
  };

  const addAnnouncementAttachment = async (localeCode: LocaleCode, index: number, file: File) => {
    const announcement = workingContent[localeCode]?.announcements.items[index];
    if (!announcement) {
      setSaveError('Unable to locate announcement for attachment upload.');
      return;
    }

    try {
      const { publicUrl, storagePath } = await uploadSiteAsset(file, {
        locale: localeCode,
        category: 'announcement-attachment',
        identifier:
          announcement.id || `${localeCode}-announcement-${index}-${Date.now().toString(36)}`,
      });

      updateLocaleContent(localeCode, (locale) => ({
        ...locale,
        announcements: {
          ...locale.announcements,
          items: locale.announcements.items.map((item, idx) =>
            idx === index
              ? {
                  ...item,
                  attachments: [
                    ...item.attachments,
                    {
                      id: `attachment-${Date.now()}`,
                      name: file.name,
                      dataUrl: publicUrl,
                      storagePath,
                    },
                  ],
                }
              : item,
          ),
        },
      }));
      setSaveError(null);
    } catch (error) {
      console.error('Failed to upload announcement attachment', error);
      setSaveError(
        error instanceof Error ? `Attachment upload failed: ${error.message}` : 'Attachment upload failed.',
      );
    }
  };

  const removeAnnouncementAttachment = (localeCode: LocaleCode, index: number, attachmentId: string) => {
    const announcement = workingContent[localeCode]?.announcements.items[index];
    const targetAttachment = announcement?.attachments.find((attachment) => attachment.id === attachmentId);
    const storagePath = targetAttachment?.storagePath;

    updateLocaleContent(localeCode, (locale) => ({
      ...locale,
      announcements: {
        ...locale.announcements,
        items: locale.announcements.items.map((item, idx) =>
          idx === index
            ? {
                ...item,
                attachments: item.attachments.filter((attachment) => attachment.id !== attachmentId),
              }
            : item,
        ),
      },
    }));

    if (storagePath) {
      void deleteSiteAsset(storagePath);
    }
  };

  const addHighlight = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      about: {
        ...locale.about,
        highlights: [
          ...locale.about.highlights,
          {
            icon: 'flask',
            title: 'New Highlight',
            description: 'Describe the highlight here.',
          },
        ],
      },
    }));
  };

  const updateHighlight = (index: number, field: keyof Highlight, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      about: {
        ...locale.about,
        highlights: locale.about.highlights.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const removeHighlight = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      about: {
        ...locale.about,
        highlights: locale.about.highlights.filter((_, idx) => idx !== index),
      },
    }));
  };

  // Gallery management
  const addGalleryImage = async (localeCode: LocaleCode, file: File) => {
    try {
      // Generate unique ID before async operation
      const newId = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      const { publicUrl, storagePath } = await uploadSiteAsset(file, {
        locale: localeCode,
        category: 'gallery',
        identifier: 'slideshow',
      });
      
      // Use applyUpdate to ensure proper state management
      applyUpdate((draft) => {
        const locale = draft[localeCode];
        if (!locale.gallery) {
          locale.gallery = {
            title: 'Gallery',
            description: 'Explore our photo gallery',
            images: [],
          };
        }
        locale.gallery.images.push({
          id: newId,
          imageUrl: publicUrl,
          storagePath,
          caption: '',
          alt: file.name,
        });
      });
    } catch (error) {
      console.error('Failed to upload gallery image:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const updateGalleryImage = (index: number, field: 'caption' | 'alt', value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      gallery: locale.gallery
        ? {
            ...locale.gallery,
            images: locale.gallery.images.map((img, idx) =>
              idx === index ? { ...img, [field]: value } : img,
            ),
          }
        : undefined,
    }));
  };

  const removeGalleryImage = async (localeCode: LocaleCode, index: number) => {
    const locale = workingContent[localeCode];
    const image = locale.gallery?.images[index];
    
    // Delete from storage first
    if (image?.storagePath) {
      try {
        await deleteSiteAsset(image.storagePath);
      } catch (error) {
        console.error('Failed to delete gallery image from storage:', error);
      }
    }

    // Then update state using applyUpdate
    applyUpdate((draft) => {
      const draftLocale = draft[localeCode];
      if (draftLocale.gallery) {
        draftLocale.gallery.images = draftLocale.gallery.images.filter((_, idx) => idx !== index);
      }
    });
  };

  const addCoreCourse = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        coreCourses: [
          ...locale.curriculum.coreCourses,
          { code: 'BINF 6XX', name: 'New Course Title', credits: '3' },
        ],
      },
    }));
  };

  const updateCoreCourse = (index: number, field: keyof Course, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        coreCourses: locale.curriculum.coreCourses.map((course, idx) =>
          idx === index ? { ...course, [field]: value } : course,
        ),
      },
    }));
  };

  const removeCoreCourse = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        coreCourses: locale.curriculum.coreCourses.filter((_, idx) => idx !== index),
      },
    }));
  };

  const addSecondSemesterCourse = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        secondSemesterCourses: [
          ...(locale.curriculum.secondSemesterCourses ?? []),
          { code: 'BINF 7XX', name: 'New Course Title', credits: '3' },
        ],
      },
    }));
  };

  const updateSecondSemesterCourse = (index: number, field: keyof Course, value: string) => {
    updateActiveLocale((locale) => {
      const courses = locale.curriculum.secondSemesterCourses ?? [];
      if (!courses[index]) {
        return locale;
      }
      return {
        ...locale,
        curriculum: {
          ...locale.curriculum,
          secondSemesterCourses: courses.map((course, idx) =>
            idx === index ? { ...course, [field]: value } : course,
          ),
        },
      };
    });
  };

  const removeSecondSemesterCourse = (index: number) => {
    updateActiveLocale((locale) => {
      const courses = locale.curriculum.secondSemesterCourses ?? [];
      if (!courses[index]) {
        return locale;
      }
      return {
        ...locale,
        curriculum: {
          ...locale.curriculum,
          secondSemesterCourses: courses.filter((_, idx) => idx !== index),
        },
      };
    });
  };

  const addCreditBreakdownItem = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        creditBreakdown: [
          ...locale.curriculum.creditBreakdown,
          { label: 'Credit Label', value: '0' },
        ],
      },
    }));
  };

  const updateCreditBreakdownItem = (index: number, field: keyof Statistic, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        creditBreakdown: locale.curriculum.creditBreakdown.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const removeCreditBreakdownItem = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        creditBreakdown: locale.curriculum.creditBreakdown.filter((_, idx) => idx !== index),
      },
    }));
  };

  // Semester management
  const addSemester = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        semesters: [
          ...(locale.curriculum.semesters || []),
          { title: 'New Semester', required: true, courses: [] },
        ],
      },
    }));
  };

  const updateSemester = (index: number, field: 'title' | 'required', value: string | boolean) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        semesters: (locale.curriculum.semesters || []).map((sem, idx) =>
          idx === index ? { ...sem, [field]: value } : sem,
        ),
      },
    }));
  };

  const removeSemester = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        semesters: (locale.curriculum.semesters || []).filter((_, idx) => idx !== index),
      },
    }));
  };

  const addCourseToSemester = (semesterIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        semesters: (locale.curriculum.semesters || []).map((sem, idx) =>
          idx === semesterIndex
            ? { ...sem, courses: [...sem.courses, { code: 'NEW-101', name: 'New Course', credits: '5', description: '' }] }
            : sem,
        ),
      },
    }));
  };

  const updateCourseInSemester = (semesterIndex: number, courseIndex: number, field: keyof Course, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        semesters: (locale.curriculum.semesters || []).map((sem, sIdx) =>
          sIdx === semesterIndex
            ? {
                ...sem,
                courses: sem.courses.map((course, cIdx) =>
                  cIdx === courseIndex ? { ...course, [field]: value } : course,
                ),
              }
            : sem,
        ),
      },
    }));
  };

  const removeCourseFromSemester = (semesterIndex: number, courseIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        semesters: (locale.curriculum.semesters || []).map((sem, idx) =>
          idx === semesterIndex ? { ...sem, courses: sem.courses.filter((_, cIdx) => cIdx !== courseIndex) } : sem,
        ),
      },
    }));
  };

  const updateThesis = (field: 'title' | 'credits' | 'description', value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      curriculum: {
        ...locale.curriculum,
        thesis: {
          ...(locale.curriculum.thesis || { title: '', credits: '30', description: '' }),
          [field]: value,
        },
      },
    }));
  };

  const addResearchArea = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      research: {
        ...locale.research,
        areas: [
          ...locale.research.areas,
          {
            icon: 'database',
            title: 'New Research Area',
            description: 'Describe the research focus.',
          },
        ],
      },
    }));
  };

  const updateResearchArea = (index: number, field: keyof ResearchArea, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      research: {
        ...locale.research,
        areas: locale.research.areas.map((area, idx) =>
          idx === index ? { ...area, [field]: value } : area,
        ),
      },
    }));
  };

  const removeResearchArea = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      research: {
        ...locale.research,
        areas: locale.research.areas.filter((_, idx) => idx !== index),
      },
    }));
  };

  const addFacultyMember = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      faculty: {
        ...locale.faculty,
        members: [
          ...locale.faculty.members,
          {
            name: 'New Faculty Member',
            title: 'Title',
            specialty: 'Specialty',
            education: 'Highest Degree, Institution',
            research: 'Research focus summary.',
          },
        ],
      },
    }));
  };

  const updateFacultyMember = (index: number, field: keyof FacultyMember, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      faculty: {
        ...locale.faculty,
        members: locale.faculty.members.map((member, idx) =>
          idx === index ? { ...member, [field]: value } : member,
        ),
      },
    }));
  };

  const removeFacultyMember = (localeCode: LocaleCode, index: number) => {
    const member = workingContent[localeCode]?.faculty.members[index];
    const storagePath = member?.photoStoragePath;

    updateLocaleContent(localeCode, (locale) => ({
      ...locale,
      faculty: {
        ...locale.faculty,
        members: locale.faculty.members.filter((_, idx) => idx !== index),
      },
    }));

    if (storagePath) {
      void deleteSiteAsset(storagePath);
    }
  };

  const copyFacultyMemberToOtherLocale = (index: number) => {
    const member = workingContent[activeLocale]?.faculty.members[index];
    if (!member) return;

    const otherLocale: LocaleCode = activeLocale === 'en' ? 'gr' : 'en';
    const memberCopy = CLONE(member);

    updateLocaleContent(otherLocale, (locale) => ({
      ...locale,
      faculty: {
        ...locale.faculty,
        members: [...locale.faculty.members, memberCopy],
      },
    }));
  };

  const moveFacultyMember = (index: number, direction: 'up' | 'down') => {
    updateActiveLocale((locale) => {
      const members = [...locale.faculty.members];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= members.length) return locale;
      [members[index], members[newIndex]] = [members[newIndex], members[index]];
      return { ...locale, faculty: { ...locale.faculty, members } };
    });
  };

  const addFacultyPhoto = async (localeCode: LocaleCode, index: number, file: File) => {
    const member = workingContent[localeCode]?.faculty.members[index];
    if (!member) {
      setSaveError('Unable to locate faculty member for photo upload.');
      return;
    }

    const previousStoragePath = member.photoStoragePath;

    try {
      const { publicUrl, storagePath } = await uploadSiteAsset(file, {
        locale: localeCode,
        category: 'faculty-photo',
        identifier: member.name || `${localeCode}-faculty-${index}`,
      });

      updateLocaleContent(localeCode, (locale) => ({
        ...locale,
        faculty: {
          ...locale.faculty,
          members: locale.faculty.members.map((item, idx) =>
            idx === index ? { ...item, photoDataUrl: publicUrl, photoStoragePath: storagePath } : item,
          ),
        },
      }));
      setSaveError(null);

      if (previousStoragePath && previousStoragePath !== storagePath) {
        void deleteSiteAsset(previousStoragePath);
      }
    } catch (error) {
      console.error('Failed to upload faculty photo', error);
      setSaveError(error instanceof Error ? `Photo upload failed: ${error.message}` : 'Photo upload failed.');
    }
  };

  const removeFacultyPhoto = (localeCode: LocaleCode, index: number) => {
    const member = workingContent[localeCode]?.faculty.members[index];
    const storagePath = member?.photoStoragePath;

    updateLocaleContent(localeCode, (locale) => ({
      ...locale,
      faculty: {
        ...locale.faculty,
        members: locale.faculty.members.map((item, idx) =>
          idx === index ? { ...item, photoDataUrl: undefined, photoStoragePath: undefined } : item,
        ),
      },
    }));

    if (storagePath) {
      void deleteSiteAsset(storagePath);
    }
  };

  const addRequirement = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        requirements: [
          ...locale.admissions.requirements,
          { title: 'Requirement Title', description: 'Requirement description.' },
        ],
      },
    }));
  };

  const updateRequirement = (index: number, field: keyof Requirement, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        requirements: locale.admissions.requirements.map((item, idx) =>
          idx === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  };

  const removeRequirement = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        requirements: locale.admissions.requirements.filter((_, idx) => idx !== index),
      },
    }));
  };

  const addCardDetail = (cardIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        cards: locale.admissions.cards.map((card, idx) =>
          idx === cardIndex
            ? {
                ...card,
                details: [...card.details, { label: 'Label', value: 'Value' }],
              }
            : card,
        ),
      },
    }));
  };

  const updateCardDetail = (
    cardIndex: number,
    detailIndex: number,
    field: keyof CardDetail,
    value: string,
  ) => {
    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        cards: locale.admissions.cards.map((card, idx) =>
          idx === cardIndex
            ? {
                ...card,
                details: card.details.map((detail, dIdx) =>
                  dIdx === detailIndex ? { ...detail, [field]: value } : detail,
                ),
              }
            : card,
        ),
      },
    }));
  };

  const removeCardDetail = (cardIndex: number, detailIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        cards: locale.admissions.cards.map((card, idx) =>
          idx === cardIndex
            ? {
                ...card,
                details: card.details.filter((_, dIdx) => dIdx !== detailIndex),
              }
            : card,
        ),
      },
    }));
  };

  const updateAdmissionCard = (cardIndex: number, field: keyof DeadlineCard, value: string) => {
    if (field === 'icon') {
      updateActiveLocale((locale) => ({
        ...locale,
        admissions: {
          ...locale.admissions,
          cards: locale.admissions.cards.map((card, idx) =>
            idx === cardIndex ? { ...card, icon: value as DeadlineCard['icon'] } : card,
          ),
        },
      }));
      return;
    }

    updateActiveLocale((locale) => ({
      ...locale,
      admissions: {
        ...locale.admissions,
        cards: locale.admissions.cards.map((card, idx) =>
          idx === cardIndex ? { ...card, [field]: value } : card,
        ),
      },
    }));
  };

  const addContactCard = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        cards: [
          ...locale.contact.cards,
          { icon: 'mapPin', title: 'New Contact Card', lines: ['Line 1', 'Line 2'] },
        ],
      },
    }));
  };

  const removeContactCard = (cardIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        cards: locale.contact.cards.filter((_, idx) => idx !== cardIndex),
      },
    }));
  };

  const updateContactCard = (cardIndex: number, field: keyof ContactCard, value: string) => {
    if (field === 'icon') {
      updateActiveLocale((locale) => ({
        ...locale,
        contact: {
          ...locale.contact,
          cards: locale.contact.cards.map((card, idx) =>
            idx === cardIndex ? { ...card, icon: value as ContactCard['icon'] } : card,
          ),
        },
      }));
      return;
    }

    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        cards: locale.contact.cards.map((card, idx) =>
          idx === cardIndex ? { ...card, [field]: value } : card,
        ),
      },
    }));
  };

  const updateContactCardLine = (cardIndex: number, lineIndex: number, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        cards: locale.contact.cards.map((card, idx) =>
          idx === cardIndex
            ? {
                ...card,
                lines: card.lines.map((line, lIdx) => (lIdx === lineIndex ? value : line)),
              }
            : card,
        ),
      },
    }));
  };

  const addContactCardLine = (cardIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        cards: locale.contact.cards.map((card, idx) =>
          idx === cardIndex
            ? { ...card, lines: [...card.lines, 'Additional detail'] }
            : card,
        ),
      },
    }));
  };

  const removeContactCardLine = (cardIndex: number, lineIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        cards: locale.contact.cards.map((card, idx) =>
          idx === cardIndex
            ? { ...card, lines: card.lines.filter((_, lIdx) => lIdx !== lineIndex) }
            : card,
        ),
      },
    }));
  };

  const addFormField = () => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        formFields: [
          ...locale.contact.formFields,
          { label: 'New Field', type: 'text', placeholder: '' },
        ],
      },
    }));
  };

  const removeFormField = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        formFields: locale.contact.formFields.filter((_, idx) => idx !== index),
      },
    }));
  };

  const updateFormField = (index: number, field: keyof FormField, value: string) => {
    if (field === 'type') {
      updateActiveLocale((locale) => ({
        ...locale,
        contact: {
          ...locale.contact,
          formFields: locale.contact.formFields.map((formField, idx) =>
            idx === index
              ? {
                  ...formField,
                  type: value as FormField['type'],
                  options:
                    value === 'select'
                      ? ['Select an option']
                      : value === 'textarea'
                      ? undefined
                      : formField.options,
                }
              : formField,
          ),
        },
      }));
      return;
    }

    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        formFields: locale.contact.formFields.map((formField, idx) =>
          idx === index ? { ...formField, [field]: value } : formField,
        ),
      },
    }));
  };

  const addFormFieldOption = (index: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        formFields: locale.contact.formFields.map((formField, idx) =>
          idx === index
            ? {
                ...formField,
                options: [...(formField.options ?? []), 'New option'],
              }
            : formField,
        ),
      },
    }));
  };

  const updateFormFieldOption = (fieldIndex: number, optionIndex: number, value: string) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        formFields: locale.contact.formFields.map((formField, idx) =>
          idx === fieldIndex
            ? {
                ...formField,
                options: formField.options?.map((option, optIdx) =>
                  optIdx === optionIndex ? value : option,
                ),
              }
            : formField,
        ),
      },
    }));
  };

  const removeFormFieldOption = (fieldIndex: number, optionIndex: number) => {
    updateActiveLocale((locale) => ({
      ...locale,
      contact: {
        ...locale.contact,
        formFields: locale.contact.formFields.map((formField, idx) =>
          idx === fieldIndex
            ? {
                ...formField,
                options: formField.options?.filter((_, optIdx) => optIdx !== optionIndex),
              }
            : formField,
        ),
      },
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-2 text-sm font-semibold text-gray-900">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Program Dashboard</span>
            </div>
            <div className="flex items-center text-xs text-gray-500 mt-1 space-x-2">
              <Save className="h-3.5 w-3.5" />
              <span>Changes save locally in your browser</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <LanguageSwitch value={activeLocale} onChange={onChangeLocale} compact />
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={handleForceSync}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-blue-500 bg-blue-500 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-blue-600"
              disabled={isSyncing}
              title="Reload content from Supabase database"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
            <button
              type="button"
              onClick={() => handleCreateBackup(false)}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-green-600 bg-green-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-green-700"
              disabled={creatingBackup}
              title="Create a backup of current content"
            >
              <Plus className={`h-3 w-3 ${creatingBackup ? 'animate-pulse' : ''}`} />
              <span>Backup</span>
            </button>
            <button
              type="button"
              onClick={openBackupModal}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-purple-500 bg-purple-500 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-purple-600"
              title="View and restore backups"
            >
              <History className="h-3 w-3" />
              <span>Restore</span>
            </button>
            <button
              type="button"
              onClick={handleUndo}
              className={undoButtonClass}
              disabled={!canUndo}
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={saveButtonClass}
              disabled={!isDirty || isSaving}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save changes'}</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-900 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
        {saveError && (
          <div className="max-w-5xl mx-auto px-6 pb-4 text-xs text-red-600">{saveError}</div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          <DashboardSection title="Branding">
            <DashboardInput
              label="Institution Name"
              value={localeContent.branding.institution}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  branding: { ...locale.branding, institution: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Program Name"
              value={localeContent.branding.program}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  branding: { ...locale.branding, program: value },
                }))
              }
              inputClass={inputClass}
            />
          </DashboardSection>

          <DashboardSection title="Navigation">
            <div className="space-y-4">
              {(localeContent.navLinks ?? []).map((link, index) => {
                const navLinks = localeContent.navLinks ?? [];
                const isFirst = index === 0;
                const isLast = index === navLinks.length - 1;
                return (
                  <div key={`nav-link-${index}`} className="space-y-2 border border-gray-200 rounded-md p-3 bg-white">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Link {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveNavLink(index, 'up')}
                          disabled={isFirst}
                          className={`p-1 rounded ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveNavLink(index, 'down')}
                          disabled={isLast}
                          className={`p-1 rounded ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {navLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeNavLink(index)}
                            className="p-1 rounded text-red-600 hover:bg-red-50"
                            aria-label="Remove link"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <DashboardInput
                      label="Label"
                      value={link.label}
                      onChange={(value) => updateNavLink(index, 'label', value)}
                      inputClass={inputClass}
                    />
                    <DashboardInput
                      label="Anchor (e.g. #about)"
                      value={link.target}
                      onChange={(value) => updateNavLink(index, 'target', value)}
                      inputClass={inputClass}
                    />
                  </div>
                );
              })}
            </div>
            <DashboardAddButton label="Add Link" onClick={addNavLink} />
          </DashboardSection>

          <DashboardSection title="Hero">
            <DashboardInput
              label="Badge Text"
              value={localeContent.hero.badgeText}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  hero: { ...locale.hero, badgeText: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Hero Title (use line breaks with Enter)"
              value={localeContent.hero.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  hero: { ...locale.hero, title: value },
                }))
              }
              textareaClass={textareaClass}
            />
            <DashboardTextarea
              label="Description"
              value={localeContent.hero.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  hero: { ...locale.hero, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <DashboardInput
              label="Tagline"
              value={localeContent.hero.tagline}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  hero: { ...locale.hero, tagline: value },
                }))
              }
              inputClass={inputClass}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <HeroCtaEditor
                title="Primary Button"
                label={localeContent.hero.primaryCta.label}
                href={localeContent.hero.primaryCta.href}
                onChange={(field, value) =>
                  updateActiveLocale((locale) => ({
                    ...locale,
                    hero: {
                      ...locale.hero,
                      primaryCta: { ...locale.hero.primaryCta, [field]: value },
                    },
                  }))
                }
                inputClass={inputClass}
              />
              <HeroCtaEditor
                title="Secondary Button"
                label={localeContent.hero.secondaryCta.label}
                href={localeContent.hero.secondaryCta.href}
                onChange={(field, value) =>
                  updateActiveLocale((locale) => ({
                    ...locale,
                    hero: {
                      ...locale.hero,
                      secondaryCta: { ...locale.hero.secondaryCta, [field]: value },
                    },
                  }))
                }
                inputClass={inputClass}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <DashboardInput
                label="Badge Link URL"
                value={localeContent.hero.clickTarget?.href ?? ''}
                onChange={(value) => updateHeroBadgeLink('href', value)}
                inputClass={inputClass}
              />
              <DashboardInput
                label="Badge Link Accessible Label"
                value={localeContent.hero.clickTarget?.ariaLabel ?? ''}
                onChange={(value) => updateHeroBadgeLink('ariaLabel', value)}
                inputClass={inputClass}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Provide a URL to make the badge clickable. Leave blank to keep the badge static.
            </p>
          </DashboardSection>

          <DashboardSection title="Program Statistics">
            <div className="space-y-3">
              {localeContent.stats.map((stat, index) => (
                <div key={`stat-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-white border border-gray-200 rounded-md p-3">
                  <input
                    className={inputClass}
                    value={stat.value}
                    onChange={(event) => updateStat(index, 'value', event.target.value)}
                  />
                  <input
                    className={inputClass}
                    value={stat.label}
                    onChange={(event) => updateStat(index, 'label', event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeStat(index)}
                    className="text-red-600 hover:text-red-700"
                    aria-label="Remove statistic"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Metric" onClick={addStat} />
          </DashboardSection>

          <DashboardSection title="Announcements">
            <DashboardInput
              label="Section Title"
              value={localeContent.announcements.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  announcements: { ...locale.announcements, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.announcements.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  announcements: { ...locale.announcements, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <div className="space-y-4">
              {localeContent.announcements.items.map((announcement, index) => (
                <div key={announcement.id} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardHeader title={`Announcement ${index + 1}`} onRemove={() => removeAnnouncement(activeLocale, index)} />
                  <DashboardInput
                    label="Title"
                    value={announcement.title}
                    onChange={(value) => updateAnnouncement(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <DashboardInput
                    label="Date"
                    value={announcement.date}
                    onChange={(value) => updateAnnouncement(index, 'date', value)}
                    inputClass={inputClass}
                  />
                  <DashboardTextarea
                    label="Summary"
                    value={announcement.summary}
                    onChange={(value) => updateAnnouncement(index, 'summary', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                  <DashboardTextarea
                    label="Full Announcement"
                    value={announcement.body}
                    onChange={(value) => updateAnnouncement(index, 'body', value)}
                    textareaClass={`${textareaClass} h-36`}
                    richText={true}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-gray-500">Attachments</span>
                      <label className="inline-flex items-center space-x-2 px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-100 cursor-pointer">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add PDF</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void addAnnouncementAttachment(activeLocale, index, file);
                              event.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    {announcement.attachments.length > 0 && (
                      <div className="space-y-2">
                        {announcement.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center justify-between text-xs text-gray-700 border border-gray-200 rounded-md px-2 py-1">
                            <span className="truncate max-w-[160px]" title={attachment.name}>
                              {attachment.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAnnouncementAttachment(activeLocale, index, attachment.id)}
                              className="text-red-600 hover:text-red-700"
                              aria-label="Remove attachment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Announcement" onClick={addAnnouncement} />
          </DashboardSection>

          <DashboardSection title="About Highlights">
            <DashboardInput
              label="Section Title"
              value={localeContent.about.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  about: { ...locale.about, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.about.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  about: { ...locale.about, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <div className="space-y-4">
              {localeContent.about.highlights.map((highlight, index) => (
                <div key={`highlight-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardHeader title={`Highlight ${index + 1}`} onRemove={() => removeHighlight(index)} />
                  <label className="block text-xs text-gray-600 mb-1">Icon</label>
                  <select
                    className={inputClass}
                    value={highlight.icon}
                    onChange={(event) => updateHighlight(index, 'icon', event.target.value)}
                  >
                    {iconOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <DashboardInput
                    label="Title"
                    value={highlight.title}
                    onChange={(value) => updateHighlight(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <DashboardTextarea
                    label="Description"
                    value={highlight.description}
                    onChange={(value) => updateHighlight(index, 'description', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Highlight" onClick={addHighlight} />
          </DashboardSection>

          <DashboardSection title="Gallery / Slideshow">
            <DashboardInput
              label="Section Title"
              value={localeContent.gallery?.title || ''}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  gallery: {
                    title: value,
                    description: locale.gallery?.description || '',
                    images: locale.gallery?.images || [],
                  },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.gallery?.description || ''}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  gallery: {
                    title: locale.gallery?.title || 'Gallery',
                    description: value,
                    images: locale.gallery?.images || [],
                  },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />

            <SectionSubheading title="Images" />
            <div className="space-y-3">
              {(localeContent.gallery?.images || []).map((image, index) => (
                <div key={image.id} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Image {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => void removeGalleryImage(activeLocale, index)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Image preview */}
                  <div className="aspect-video w-full bg-gray-100 rounded overflow-hidden">
                    <img
                      src={image.imageUrl}
                      alt={image.alt || image.caption || 'Gallery image'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <DashboardInput
                    label="Caption (optional)"
                    value={image.caption || ''}
                    onChange={(value) => updateGalleryImage(index, 'caption', value)}
                    inputClass={inputClass}
                  />
                  <DashboardInput
                    label="Alt Text (for accessibility)"
                    value={image.alt || ''}
                    onChange={(value) => updateGalleryImage(index, 'alt', value)}
                    inputClass={inputClass}
                  />
                </div>
              ))}
            </div>

            {/* Add Image Button */}
            <label className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-md cursor-pointer">
              <Plus className="h-4 w-4" />
              <span>Add Image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void addGalleryImage(activeLocale, file);
                    event.target.value = '';
                  }
                }}
              />
            </label>
          </DashboardSection>

          <DashboardSection title="Curriculum">
            <DashboardInput
              label="Section Title"
              value={localeContent.curriculum.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  curriculum: { ...locale.curriculum, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.curriculum.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  curriculum: { ...locale.curriculum, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />

            <SectionSubheading title="Semesters" />
            <div className="space-y-4">
              {(localeContent.curriculum.semesters || []).map((semester, semIndex) => (
                <div key={`sem-${semIndex}`} className="bg-gray-50 border border-gray-300 rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">Semester {semIndex + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeSemester(semIndex)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Remove semester"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <DashboardInput
                    label="Semester Title"
                    value={semester.title}
                    onChange={(value) => updateSemester(semIndex, 'title', value)}
                    inputClass={inputClass}
                  />
                  <label className="flex items-center text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={semester.required !== false}
                      onChange={(e) => updateSemester(semIndex, 'required', e.target.checked)}
                      className="mr-2"
                    />
                    Required Semester
                  </label>
                  
                  <div className="mt-3">
                    <h5 className="text-xs font-semibold text-gray-700 mb-2">Courses</h5>
                    <div className="space-y-2">
                      {semester.courses.map((course, courseIndex) => (
                        <div key={`course-${courseIndex}`} className="bg-white border border-gray-200 rounded p-2 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-gray-600">Course {courseIndex + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeCourseFromSemester(semIndex, courseIndex)}
                              className="text-red-600 hover:text-red-700"
                              aria-label="Remove course"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className={inputClass}
                              placeholder="Code"
                              value={course.code}
                              onChange={(e) => updateCourseInSemester(semIndex, courseIndex, 'code', e.target.value)}
                            />
                            <input
                              className={inputClass}
                              placeholder="ECTS"
                              value={course.credits}
                              onChange={(e) => updateCourseInSemester(semIndex, courseIndex, 'credits', e.target.value)}
                            />
                          </div>
                          <input
                            className={inputClass}
                            placeholder="Course Name"
                            value={course.name}
                            onChange={(e) => updateCourseInSemester(semIndex, courseIndex, 'name', e.target.value)}
                          />
                          <RichTextEditor
                            label="Description (shown when expanded)"
                            value={course.description || ''}
                            onChange={(value) => updateCourseInSemester(semIndex, courseIndex, 'description', value)}
                            className={`${textareaClass} h-32`}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addCourseToSemester(semIndex)}
                      className="mt-2 flex items-center text-sm text-gray-700 hover:text-gray-900"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Course
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Semester" onClick={addSemester} />

            <SectionSubheading title="Thesis" />
            <div className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
              <DashboardInput
                label="Title"
                value={localeContent.curriculum.thesis?.title || ''}
                onChange={(value) => updateThesis('title', value)}
                inputClass={inputClass}
              />
              <DashboardInput
                label="ECTS"
                value={localeContent.curriculum.thesis?.credits || '30'}
                onChange={(value) => updateThesis('credits', value)}
                inputClass={inputClass}
              />
              <DashboardTextarea
                label="Description"
                value={localeContent.curriculum.thesis?.description || ''}
                onChange={(value) => updateThesis('description', value)}
                textareaClass={textareaClass}
                richText={true}
              />
            </div>

            <SectionSubheading title="Core Curriculum (1st Semester)" />
            <DashboardInput
              label="Main Title"
              value={localeContent.curriculum.coreTitle}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  curriculum: { ...locale.curriculum, coreTitle: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Subtitle"
              value={localeContent.curriculum.coreSubtitle ?? ''}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  curriculum: { ...locale.curriculum, coreSubtitle: value },
                }))
              }
              inputClass={inputClass}
            />
            <div className="space-y-3">
              {localeContent.curriculum.coreCourses.map((course, index) => (
                <div key={`core-course-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      className={inputClass}
                      value={course.code}
                      onChange={(event) => updateCoreCourse(index, 'code', event.target.value)}
                    />
                    <input
                      className={inputClass}
                      value={course.credits}
                      onChange={(event) => updateCoreCourse(index, 'credits', event.target.value)}
                    />
                  </div>
                  <textarea
                    className={textareaClass}
                    value={course.name}
                    onChange={(event) => updateCoreCourse(index, 'name', event.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeCoreCourse(index)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Remove course"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Course" onClick={addCoreCourse} />

            <SectionSubheading title="Core Curriculum (2nd Semester)" />
            <DashboardInput
              label="Main Title"
              value={localeContent.curriculum.secondSemesterTitle ?? ''}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  curriculum: { ...locale.curriculum, secondSemesterTitle: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Subtitle"
              value={localeContent.curriculum.secondSemesterSubtitle ?? ''}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  curriculum: { ...locale.curriculum, secondSemesterSubtitle: value },
                }))
              }
              inputClass={inputClass}
            />
            <div className="space-y-3">
              {(localeContent.curriculum.secondSemesterCourses ?? []).map((course, index) => (
                <div key={`second-course-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <input
                      className={inputClass}
                      value={course.code}
                      onChange={(event) => updateSecondSemesterCourse(index, 'code', event.target.value)}
                    />
                    <input
                      className={inputClass}
                      value={course.credits}
                      onChange={(event) => updateSecondSemesterCourse(index, 'credits', event.target.value)}
                    />
                  </div>
                  <textarea
                    className={textareaClass}
                    value={course.name}
                    onChange={(event) => updateSecondSemesterCourse(index, 'name', event.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeSecondSemesterCourse(index)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Remove course"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Course" onClick={addSecondSemesterCourse} />

            <SectionSubheading title="Credit Breakdown" />
            <div className="space-y-3">
              {localeContent.curriculum.creditBreakdown.map((item, index) => (
                <div key={`credit-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardInput
                    label="Value"
                    value={item.value}
                    onChange={(value) => updateCreditBreakdownItem(index, 'value', value)}
                    inputClass={inputClass}
                  />
                  <DashboardInput
                    label="Label"
                    value={item.label}
                    onChange={(value) => updateCreditBreakdownItem(index, 'label', value)}
                    inputClass={inputClass}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeCreditBreakdownItem(index)}
                      className={`text-red-600 hover:text-red-700 ${localeContent.curriculum.creditBreakdown.length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                      aria-label="Remove credit breakdown item"
                      disabled={localeContent.curriculum.creditBreakdown.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Credit Item" onClick={addCreditBreakdownItem} />
          </DashboardSection>

          <DashboardSection title="Research Areas">
            <DashboardInput
              label="Section Title"
              value={localeContent.research.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  research: { ...locale.research, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.research.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  research: { ...locale.research, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <div className="space-y-3">
              {localeContent.research.areas.map((area, index) => (
                <div key={`research-area-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardHeader title={`Area ${index + 1}`} onRemove={() => removeResearchArea(index)} />
                  <select
                    className={inputClass}
                    value={area.icon}
                    onChange={(event) => updateResearchArea(index, 'icon', event.target.value)}
                  >
                    {iconOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <DashboardInput
                    label="Title"
                    value={area.title}
                    onChange={(value) => updateResearchArea(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <DashboardTextarea
                    label="Description"
                    value={area.description}
                    onChange={(value) => updateResearchArea(index, 'description', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Research Area" onClick={addResearchArea} />
          </DashboardSection>

          <DashboardSection title="Faculty">
            <DashboardInput
              label="Section Title"
              value={localeContent.faculty.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  faculty: { ...locale.faculty, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.faculty.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  faculty: { ...locale.faculty, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <div className="space-y-3">
              {localeContent.faculty.members.map((member, index) => {
                const isFirst = index === 0;
                const isLast = index === localeContent.faculty.members.length - 1;
                return (
                <div key={`faculty-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500">Faculty {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveFacultyMember(index, 'up')}
                        disabled={isFirst}
                        className={`p-1 rounded ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFacultyMember(index, 'down')}
                        disabled={isLast}
                        className={`p-1 rounded ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => copyFacultyMemberToOtherLocale(index)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        title={activeLocale === 'en' ? 'Copy to Greek' : 'Copy to English'}
                      >
                        <Copy className="h-4 w-4" />
                        <span className="text-xs">{activeLocale === 'en' ? 'Copy to Greek' : 'Copy to English'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFacultyMember(activeLocale, index)}
                        className="text-red-600 hover:text-red-700"
                        aria-label="Remove faculty"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 border border-dashed border-gray-300 rounded p-3">
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <ImageIcon className="h-4 w-4" />
                      <span>{member.photoDataUrl ? 'Photo uploaded' : 'No photo uploaded'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="inline-flex items-center space-x-2 px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-100 cursor-pointer">
                        <Plus className="h-3.5 w-3.5" />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void addFacultyPhoto(activeLocale, index, file);
                              event.target.value = '';
                            }
                          }}
                        />
                      </label>
                      {member.photoDataUrl && (
                        <button
                          type="button"
                          onClick={() => removeFacultyPhoto(activeLocale, index)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <DashboardInput
                    label="Name"
                    value={member.name}
                    onChange={(value) => updateFacultyMember(index, 'name', value)}
                    inputClass={inputClass}
                  />
                  <DashboardInput
                    label="Title"
                    value={member.title}
                    onChange={(value) => updateFacultyMember(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <DashboardInput
                    label="Specialty"
                    value={member.specialty}
                    onChange={(value) => updateFacultyMember(index, 'specialty', value)}
                    inputClass={inputClass}
                  />
                  <DashboardTextarea
                    label="Short Summary"
                    value={member.summary ?? ''}
                    onChange={(value) => updateFacultyMember(index, 'summary', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                  <DashboardTextarea
                    label="Research focus"
                    value={member.research}
                    onChange={(value) => updateFacultyMember(index, 'research', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                  <DashboardTextarea
                    label="Courses"
                    value={member.courses ?? ''}
                    onChange={(value) => updateFacultyMember(index, 'courses', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                </div>
                );
              })}
            </div>
            <DashboardAddButton label="Add Faculty Member" onClick={addFacultyMember} />
          </DashboardSection>

          <DashboardSection title="Admissions">
            <DashboardInput
              label="Section Title"
              value={localeContent.admissions.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  admissions: { ...locale.admissions, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.admissions.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  admissions: { ...locale.admissions, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <DashboardInput
              label="Requirements Title"
              value={localeContent.admissions.requirementsTitle}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  admissions: { ...locale.admissions, requirementsTitle: value },
                }))
              }
              inputClass={inputClass}
            />
            <div className="space-y-3">
              {localeContent.admissions.requirements.map((requirement, index) => (
                <div key={`requirement-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardHeader title={`Requirement ${index + 1}`} onRemove={() => removeRequirement(index)} />
                  <DashboardInput
                    label="Title"
                    value={requirement.title}
                    onChange={(value) => updateRequirement(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <DashboardTextarea
                    label="Description"
                    value={requirement.description}
                    onChange={(value) => updateRequirement(index, 'description', value)}
                    textareaClass={textareaClass}
                    richText={true}
                  />
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Requirement" onClick={addRequirement} />

            <div className="space-y-4">
              {localeContent.admissions.cards.map((card, index) => (
                <div key={`admissions-card-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <SectionSubheading title={`Card ${index + 1}`} />
                  <select
                    className={inputClass}
                    value={card.icon}
                    onChange={(event) => updateAdmissionCard(index, 'icon', event.target.value)}
                  >
                    {iconOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <DashboardInput
                    label="Title"
                    value={card.title}
                    onChange={(value) => updateAdmissionCard(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={inputClass}
                      value={card.ctaLabel}
                      onChange={(event) => updateAdmissionCard(index, 'ctaLabel', event.target.value)}
                      placeholder="Button label"
                    />
                    <input
                      className={inputClass}
                      value={card.ctaTarget}
                      onChange={(event) => updateAdmissionCard(index, 'ctaTarget', event.target.value)}
                      placeholder="Link target"
                    />
                  </div>
                  <div className="space-y-2">
                    {card.details.map((detail, detailIndex) => (
                      <div key={`card-${index}-detail-${detailIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input
                          className={inputClass}
                          value={detail.label}
                          onChange={(event) => updateCardDetail(index, detailIndex, 'label', event.target.value)}
                          placeholder="Label"
                        />
                        <input
                          className={inputClass}
                          value={detail.value}
                          onChange={(event) => updateCardDetail(index, detailIndex, 'value', event.target.value)}
                          placeholder="Value"
                        />
                        <button
                          type="button"
                          onClick={() => removeCardDetail(index, detailIndex)}
                          className="text-red-600 hover:text-red-700"
                          aria-label="Remove detail"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <DashboardAddButton label="Add Detail" onClick={() => addCardDetail(index)} small />
                </div>
              ))}
            </div>
          </DashboardSection>

          <DashboardSection title="Contact">
            <DashboardInput
              label="Section Title"
              value={localeContent.contact.title}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  contact: { ...locale.contact, title: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardTextarea
              label="Section Description"
              value={localeContent.contact.description}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  contact: { ...locale.contact, description: value },
                }))
              }
              textareaClass={textareaClass}
              richText={true}
            />
            <div className="space-y-3">
              {localeContent.contact.cards.map((card, index) => (
                <div key={`contact-card-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardHeader title={`Card ${index + 1}`} onRemove={() => removeContactCard(index)} />
                  <select
                    className={inputClass}
                    value={card.icon}
                    onChange={(event) => updateContactCard(index, 'icon', event.target.value)}
                  >
                    {iconOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <DashboardInput
                    label="Title"
                    value={card.title}
                    onChange={(value) => updateContactCard(index, 'title', value)}
                    inputClass={inputClass}
                  />
                  <div className="space-y-2">
                    {card.lines.map((line, lineIndex) => (
                      <div key={`contact-card-${index}-line-${lineIndex}`} className="flex items-center space-x-2">
                        <input
                          className={inputClass}
                          value={line}
                          onChange={(event) => updateContactCardLine(index, lineIndex, event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeContactCardLine(index, lineIndex)}
                          className="text-red-600 hover:text-red-700"
                          aria-label="Remove contact line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <DashboardAddButton label="Add Line" onClick={() => addContactCardLine(index)} small />
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Contact Card" onClick={addContactCard} />

            <DashboardInput
              label="Office Hours"
              value={localeContent.contact.officeHours}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  contact: { ...locale.contact, officeHours: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Form Title"
              value={localeContent.contact.formTitle}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  contact: { ...locale.contact, formTitle: value },
                }))
              }
              inputClass={inputClass}
            />
            <div className="space-y-3">
              {localeContent.contact.formFields.map((field, index) => (
                <div key={`form-field-${index}`} className="bg-white border border-gray-200 rounded-md p-3 space-y-2">
                  <DashboardHeader title={`Field ${index + 1}`} onRemove={() => removeFormField(index)} />
                  <DashboardInput
                    label="Label"
                    value={field.label}
                    onChange={(value) => updateFormField(index, 'label', value)}
                    inputClass={inputClass}
                  />
                  <select
                    className={inputClass}
                    value={field.type}
                    onChange={(event) => updateFormField(index, 'type', event.target.value)}
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="select">Select</option>
                    <option value="textarea">Textarea</option>
                  </select>
                  {field.type !== 'select' && (
                    <DashboardInput
                      label="Placeholder text"
                      value={field.placeholder ?? ''}
                      onChange={(value) => updateFormField(index, 'placeholder', value)}
                      inputClass={inputClass}
                    />
                  )}
                  {field.type === 'select' && (
                    <div className="space-y-2">
                      {field.options?.map((option, optionIndex) => (
                        <div key={`form-field-${index}-option-${optionIndex}`} className="flex items-center space-x-2">
                          <input
                            className={inputClass}
                            value={option}
                            onChange={(event) => updateFormFieldOption(index, optionIndex, event.target.value)}
                            placeholder="Option"
                          />
                          <button
                            type="button"
                            onClick={() => removeFormFieldOption(index, optionIndex)}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Remove option"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <DashboardAddButton label="Add Option" onClick={() => addFormFieldOption(index)} small />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <DashboardAddButton label="Add Form Field" onClick={addFormField} />
            <DashboardInput
              label="Submit Button Label"
              value={localeContent.contact.submitLabel}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  contact: { ...locale.contact, submitLabel: value },
                }))
              }
              inputClass={inputClass}
            />
          </DashboardSection>

          <DashboardSection title="Footer">
            <DashboardInput
              label="Institution"
              value={localeContent.footer.institution}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  footer: { ...locale.footer, institution: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Subheading"
              value={localeContent.footer.subheading}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  footer: { ...locale.footer, subheading: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Copyright Line"
              value={localeContent.footer.copyright}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  footer: { ...locale.footer, copyright: value },
                }))
              }
              inputClass={inputClass}
            />
            <DashboardInput
              label="Legal Line"
              value={localeContent.footer.legal}
              onChange={(value) =>
                updateActiveLocale((locale) => ({
                  ...locale,
                  footer: { ...locale.footer, legal: value },
                }))
              }
              inputClass={inputClass}
            />
          </DashboardSection>
      </main>

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Restore from Backup</h2>
                <p className="text-xs text-gray-500">Last 10 backups are kept</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingBackups ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading backups...</p>
              ) : backups.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No backups found. Create one above.</p>
              ) : (
                <div className="space-y-2">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {backup.label || `Backup #${backup.id}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(backup.saved_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreBackup(backup.id)}
                        disabled={restoringBackup === backup.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
                      >
                        {restoringBackup === backup.id ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <History className="h-3 w-3" />
                            Restore
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type DashboardSectionProps = {
  title: string;
  children: ReactNode;
};

function DashboardSection({ title, children }: DashboardSectionProps) {
  return (
    <div className="border border-gray-200 rounded-md bg-white">
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}

type DashboardInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
};

function DashboardInput({ label, value, onChange, inputClass }: DashboardInputProps) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type DashboardTextareaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textareaClass: string;
  richText?: boolean; // Enable rich text formatting
};

function DashboardTextarea({ label, value, onChange, textareaClass, richText = false }: DashboardTextareaProps) {
  if (richText) {
    return (
      <RichTextEditor
        label={label}
        value={value}
        onChange={onChange}
        className={textareaClass}
      />
    );
  }
  
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <textarea
        className={textareaClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

type DashboardHeaderProps = {
  title: string;
  onRemove?: () => void;
  canRemove?: boolean;
  onCopy?: () => void;
  copyLabel?: string;
};

function DashboardHeader({ title, onRemove, canRemove = true, onCopy, copyLabel }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase text-gray-500">{title}</span>
      <div className="flex items-center gap-2">
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            aria-label={copyLabel ?? `Copy ${title}`}
            title={copyLabel ?? `Copy to other language`}
          >
            <Copy className="h-4 w-4" />
            <span className="text-xs">{copyLabel ?? 'Copy to other lang'}</span>
          </button>
        )}
        {onRemove && canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700"
            aria-label={`Remove ${title}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

type DashboardAddButtonProps = {
  label: string;
  onClick: () => void;
  small?: boolean;
};

function DashboardAddButton({ label, onClick, small }: DashboardAddButtonProps) {
  const sizeClass = small ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center space-x-2 ${sizeClass} font-semibold text-gray-700 border border-gray-300 rounded-md bg-white hover:bg-gray-100`}
    >
      <Plus className={small ? 'h-3 w-3' : 'h-4 w-4'} />
      <span>{label}</span>
    </button>
  );
}

type HeroCtaEditorProps = {
  title: string;
  label: string;
  href: string;
  onChange: (field: 'label' | 'href', value: string) => void;
  inputClass: string;
};

function HeroCtaEditor({ title, label, href, onChange, inputClass }: HeroCtaEditorProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase text-gray-500">{title}</h4>
      <input
        className={inputClass}
        value={label}
        onChange={(event) => onChange('label', event.target.value)}
        placeholder="Label"
      />
      <input
        className={inputClass}
        value={href}
        onChange={(event) => onChange('href', event.target.value)}
        placeholder="Link target"
      />
    </div>
  );
}

type SectionSubheadingProps = {
  title: string;
};

function SectionSubheading({ title }: SectionSubheadingProps) {
  return <h4 className="text-xs font-semibold uppercase text-gray-500">{title}</h4>;
}
