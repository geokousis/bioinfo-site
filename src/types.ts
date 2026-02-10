import type { LucideIcon } from 'lucide-react';

export type LocaleCode = 'en' | 'gr';

export type Attachment = {
  id: string;
  name: string;
  dataUrl: string;
  storagePath?: string;
};

export type GalleryImage = {
  id: string;
  imageUrl: string;
  storagePath?: string;
  caption?: string;
  alt?: string;
};

export type NavLink = { label: string; target: string };
export type Statistic = { label: string; value: string };
export type AnnouncementItem = {
  id: string;
  title: string;
  date: string;
  summary: string;
  body: string;
  attachments: Attachment[];
};
export type Highlight = { title: string; description: string; icon: IconKey };
export type Course = { code: string; name: string; credits: string; description?: string };
export type Semester = { title: string; required?: boolean; courses: Course[] };
export type ResearchArea = { title: string; description: string; icon: IconKey };
export type FacultyMember = {
  name: string;
  title: string;
  specialty: string;
  education: string;
  research: string;
  courses?: string;
  summary?: string;
  bio?: string;
  photoDataUrl?: string;
  photoStoragePath?: string;
};
export type Requirement = { title: string; description: string };
export type CardDetail = { label: string; value: string };
export type DeadlineCard = { icon: IconKey; title: string; details: CardDetail[]; ctaLabel: string; ctaTarget: string };
export type ContactCard = { icon: IconKey; title: string; lines: string[] };
export type FormField = {
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea';
  options?: string[];
  placeholder?: string;
};

export type IconKey =
  | 'flask'
  | 'graduation'
  | 'users'
  | 'database'
  | 'microscope'
  | 'brain'
  | 'dna'
  | 'bookmark'
  | 'mapPin'
  | 'phone'
  | 'mail'
  | 'award'
  | 'calendar';

export type LocaleContent = {
  branding: { institution: string; program: string };
  navLinks: NavLink[];
  hero: {
    badgeText: string;
    title: string;
    description: string;
    tagline: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    clickTarget?: { href: string; ariaLabel?: string };
  };
  stats: Statistic[];
  announcements: {
    title: string;
    description: string;
    items: AnnouncementItem[];
  };
  about: {
    title: string;
    description: string;
    highlights: Highlight[];
  };
  gallery?: {
    title: string;
    description: string;
    images: GalleryImage[];
  };
  curriculum: {
    title: string;
    description: string;
    coreTitle: string;
    coreSubtitle?: string;
    coreCourses: Course[];
    secondSemesterTitle?: string;
    secondSemesterSubtitle?: string;
    secondSemesterCourses?: Course[];
    creditBreakdown: Statistic[];
    semesters?: Semester[];
    thesis?: { title?: string; credits: string; description?: string };
  };
  research: {
    title: string;
    description: string;
    areas: ResearchArea[];
  };
  faculty: {
    title: string;
    description: string;
    members: FacultyMember[];
  };
  admissions: {
    title: string;
    description: string;
    requirementsTitle: string;
    requirements: Requirement[];
    cards: DeadlineCard[];
  };
  contact: {
    title: string;
    description: string;
    cards: ContactCard[];
    officeHours: string;
    formTitle: string;
    submitLabel: string;
    formFields: FormField[];
  };
  footer: {
    institution: string;
    subheading: string;
    copyright: string;
    legal: string;
  };
};

export type SiteContent = Record<LocaleCode, LocaleContent>;

export type StoredState = {
  content: SiteContent;
  activeLocale: LocaleCode;
};

export type IconMap = Record<IconKey, LucideIcon>;
