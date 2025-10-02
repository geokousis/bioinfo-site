import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
  Megaphone,
  Menu,
  Users,
  X
} from 'lucide-react';

import type {
  AnnouncementItem,
  LocaleCode,
  SiteContent,
  StoredState
} from './types';
import { iconMap } from './icons';
import { STORAGE_KEY, initialContent, localeLabels } from './content';
import { fetchSiteContent } from './lib/contentService';
import { LanguageSwitch } from './components/LanguageSwitch';
import { AdminPage } from './pages/AdminPage';
import { AnnouncementDetailOverlay } from './components/AnnouncementDetailOverlay';
import { FacultyDetailOverlay } from './components/FacultyDetailOverlay';
import { RevealOnScroll } from './components/RevealOnScroll';
import { ImageSlideshow } from './components/ImageSlideshow';
import { FormattedText } from './components/FormattedText';

type SelectedAnnouncement = {
  locale: LocaleCode;
  id: string;
};

type SelectedFaculty = {
  locale: LocaleCode;
  index: number;
};

type ProgramSiteProps = {
  content: SiteContent;
  activeLocale: LocaleCode;
  onChangeLocale: (locale: LocaleCode) => void;
};

function App() {
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('en');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredState | SiteContent | unknown;
        if (isStoredState(parsed)) {
          setContent(parsed.content);
          setActiveLocale(parsed.activeLocale ?? 'en');
        } else if (isSiteContent(parsed)) {
          setContent(parsed);
        }
      } catch (error) {
        console.error('Failed to parse stored content', error);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        if (event.key === STORAGE_KEY && event.newValue === null) {
          setContent(initialContent);
          setActiveLocale('en');
        }
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue) as StoredState | SiteContent | unknown;
        if (isStoredState(parsed)) {
          setContent(parsed.content);
          setActiveLocale(parsed.activeLocale ?? 'en');
        } else if (isSiteContent(parsed)) {
          setContent(parsed);
        }
      } catch (error) {
        console.error('Failed to parse stored content from storage event', error);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const data: StoredState = {
      content,
      activeLocale,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [content, activeLocale]);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteContent = async () => {
      try {
        const remote = await fetchSiteContent();
        if (!cancelled && remote) {
          setContent(remote);
        }
      } catch (error) {
        console.error('Failed to load content from Supabase', error);
      }
    };

    loadRemoteContent();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveContent = async (next: SiteContent) => {
    setContent(next);
  };

  return (
    <Routes>
      <Route
        path="/admin"
        element={
          <AdminPage
            content={content}
            onSaveContent={handleSaveContent}
            activeLocale={activeLocale}
            onChangeLocale={setActiveLocale}
          />
        }
      />
      <Route
        path="/"
        element={
          <ProgramSite
            content={content}
            activeLocale={activeLocale}
            onChangeLocale={setActiveLocale}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProgramSite({ content, activeLocale, onChangeLocale }: ProgramSiteProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<SelectedAnnouncement | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<SelectedFaculty | null>(null);
  const [openSemesters, setOpenSemesters] = useState<Record<number, boolean>>({});
  const [openCourse, setOpenCourse] = useState<Record<string, boolean>>({});

  const localeContent = content[activeLocale];

  if (!localeContent) {
    return null;
  }

  const badgeClickTarget = localeContent.hero.clickTarget;
  const badgeClickHref = badgeClickTarget?.href?.trim();
  const badgeClickAriaLabel = badgeClickTarget?.ariaLabel?.trim() || localeContent.hero.badgeText;

  const handleSelectAnnouncement = (id: string) => {
    setSelectedAnnouncement({ locale: activeLocale, id });
  };

  const handleSelectFaculty = (index: number) => {
    setSelectedFaculty({ locale: activeLocale, index });
  };

  const toggleSemester = (semesterIndex: number) => {
    setOpenSemesters((prev) => {
      const nextIsOpen = !prev[semesterIndex];
      if (!nextIsOpen) {
        setOpenCourse((prevCourses) => {
          const updated = { ...prevCourses };
          Object.keys(updated).forEach((key) => {
            if (key.startsWith(`${semesterIndex}-`)) {
              delete updated[key];
            }
          });
          return updated;
        });
      }
      return { ...prev, [semesterIndex]: nextIsOpen };
    });
  };

  const toggleCourse = (semesterIndex: number, courseCode: string) => {
    const key = `${semesterIndex}-${courseCode}`;
    setOpenCourse((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedAnnouncementData = selectedAnnouncement
    ? findAnnouncement(content, selectedAnnouncement)
    : null;

  const selectedFacultyData = selectedFaculty
    ? content[selectedFaculty.locale].faculty.members[selectedFaculty.index] ?? null
    : null;

  const secondSemesterCourses = localeContent.curriculum.secondSemesterCourses ?? [];
  const totalSecondSemesterEcts = secondSemesterCourses.reduce(
    (acc, course) => acc + Number.parseInt(course.credits, 10),
    0,
  );

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 w-full bg-white z-50 border-b border-gray-300 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="relative flex items-center h-20">
            <a href="/" className="flex items-center space-x-2.5">
              <div className="h-[4.25rem] w-[4.25rem]">
                <img
                  src="/data/images/UoC_logo_overlay.png"
                  alt={`${localeContent.branding.institution} logo`}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {localeContent.branding.institution}
                </span>
                <span className="text-xl font-serif font-bold text-gray-900">
                  {localeContent.branding.program}
                </span>
              </div>
            </a>

            <div className="hidden lg:flex items-center space-x-12 absolute left-1/2 -translate-x-1/2">
              {localeContent.navLinks.map((link) => (
                <a
                  key={`${link.target}-${link.label}`}
                  href={link.target}
                  className="text-gray-700 hover:text-gray-900 transition-colors font-medium text-base"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center ml-auto">
              <LanguageSwitch value={activeLocale} onChange={onChangeLocale} />
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 ml-auto"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200">
            <div className="px-4 py-3 space-y-3">
              {localeContent.navLinks.map((link) => (
                <a
                  key={`${link.target}-${link.label}`}
                  href={link.target}
                  className="block text-gray-700 hover:text-gray-900 transition-colors font-medium"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t border-gray-200">
                <LanguageSwitch value={activeLocale} onChange={(locale) => {
                  onChangeLocale(locale);
                  setMobileMenuOpen(false);
                }} />
              </div>
            </div>
          </div>
        )}
      </nav>

      <main>
  <section className="relative overflow-hidden pt-28 pb-20 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-gray-50 via-white to-white border-b border-gray-200">
          <div aria-hidden className="absolute inset-0">
            <div className="absolute -top-32 -left-24 w-[28rem] h-[28rem] bg-gradient-to-br from-sky-400/30 via-cyan-300/20 to-transparent blur-3xl rounded-full" />
            <div className="absolute top-24 right-0 w-[32rem] h-[32rem] bg-gradient-to-tr from-purple-400/20 via-indigo-300/10 to-transparent blur-3xl rounded-full" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_30%_20%,rgba(255,255,255,0.8),rgba(255,255,255,0))]" />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white via-white/80 to-transparent" />
          </div>
          <div className="relative max-w-[82rem] mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block mb-6">
                {badgeClickHref ? (
                  <a
                    href={badgeClickHref}
                    aria-label={badgeClickAriaLabel}
                    className="flex items-center justify-center px-6 py-3 bg-gray-900 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                  >
                    <span className="text-sm font-semibold uppercase tracking-wider">
                      {localeContent.hero.badgeText}
                    </span>
                  </a>
                ) : (
                  <div className="flex items-center justify-center px-6 py-3 bg-gray-900 text-white">
                    <span className="text-sm font-semibold uppercase tracking-wider">
                      {localeContent.hero.badgeText}
                    </span>
                  </div>
                )}
              </div>
              <h1 className="text-[3.3rem] lg:text-[4.2rem] font-serif font-bold text-gray-900 mb-5 leading-tight">
                {localeContent.hero.title.split('\n').map((line, index) => (
                  <span key={index} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              <p className="text-[1.35rem] text-gray-700 max-w-3xl mx-auto mb-4 leading-relaxed">
                {localeContent.hero.description}
              </p>
              <p className="text-[1.1rem] text-gray-600 max-w-2xl mx-auto mb-10">
                {localeContent.hero.tagline}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href={localeContent.hero.primaryCta.href}
                  className="inline-flex items-center justify-center px-8 py-4 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
                >
                  {localeContent.hero.primaryCta.label}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
                <a
                  href={localeContent.hero.secondaryCta.href}
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-900 font-semibold border-2 border-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {localeContent.hero.secondaryCta.label}
                </a>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-5xl mx-auto">
              {localeContent.stats.map((stat, index) => (
                <RevealOnScroll key={`${stat.label}-${index}`} delayMs={index * 80}>
                  <div className="bg-white border border-gray-300 p-6 text-center">
                    <div className="text-[2.6rem] font-serif font-bold text-gray-900 mb-2">{stat.value}</div>
                    <div className="text-sm text-gray-600 uppercase tracking-wide">{stat.label}</div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </div>
        </section>

        <section id="announcements" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="h-12 w-12 bg-gray-900 text-white flex items-center justify-center">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <h2 className="text-3xl font-serif font-bold text-gray-900">
                    {localeContent.announcements.title}
                  </h2>
                </div>
                <p className="text-lg text-gray-700 max-w-3xl">
                  {localeContent.announcements.description}
                </p>
              </div>
              <span className="inline-flex items-center text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2">
                {localeContent.announcements.items.length} active
                {localeContent.announcements.items.length === 1 ? ' update' : ' updates'}
              </span>
            </div>

            {localeContent.announcements.items.length === 0 ? (
              <div className="border border-dashed border-gray-300 p-12 text-center text-gray-500">
                No announcements available. Use the dashboard to add updates.
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                {localeContent.announcements.items.map((announcement, index) => (
                  <RevealOnScroll key={announcement.id} delayMs={index * 80}>
                    <AnnouncementPreview
                      announcement={announcement}
                      onSelect={() => handleSelectAnnouncement(announcement.id)}
                    />
                  </RevealOnScroll>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                {localeContent.about.title}
              </h2>
              <div className="w-24 h-1 bg-gray-900 mb-8" />
              <FormattedText
                text={localeContent.about.description}
                className="text-lg text-gray-700 leading-relaxed max-w-4xl"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {localeContent.about.highlights.map((highlight, index) => {
                const IconComponent = iconMap[highlight.icon];
                return (
                  <RevealOnScroll key={`${highlight.title}-${index}`} delayMs={index * 80}>
                    <div className="border-l-4 border-gray-900 pl-6">
                      <IconComponent className="h-10 w-10 text-gray-900 mb-4" />
                      <h3 className="text-xl font-serif font-bold text-gray-900 mb-3">
                        {highlight.title}
                      </h3>
                      <FormattedText
                        text={highlight.description}
                        className="text-gray-700 leading-relaxed"
                      />
                    </div>
                  </RevealOnScroll>
                );
              })}
            </div>
          </div>
        </section>

        {/* Image Gallery / Slideshow Section */}
        {localeContent.gallery && localeContent.gallery.images.length > 0 && (
          <section id="gallery" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-b border-gray-200">
            <div className="max-w-6xl mx-auto">
              <div className="mb-12">
                <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                  {localeContent.gallery.title}
                </h2>
                <div className="w-24 h-1 bg-gray-900 mb-8" />
                <FormattedText
                  text={localeContent.gallery.description}
                  className="text-lg text-gray-700 leading-relaxed max-w-4xl"
                />
              </div>
              
              <RevealOnScroll>
                <ImageSlideshow images={localeContent.gallery.images} autoPlayInterval={5000} />
              </RevealOnScroll>
            </div>
          </section>
        )}

        <section id="program" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                {localeContent.curriculum.title}
              </h2>
              <div className="w-24 h-1 bg-gray-900 mb-8" />
              <FormattedText
                text={localeContent.curriculum.description}
                className="text-lg text-gray-700 leading-relaxed max-w-4xl"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white border border-gray-300 p-8">
                <div className="flex items-start mb-6 pb-4 border-b border-gray-300">
                  <BookOpen className="h-7 w-7 text-gray-900 mr-3 mt-1" />
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-gray-900">
                      {localeContent.curriculum.coreTitle}
                    </h3>
                    {localeContent.curriculum.coreSubtitle && (
                      <p className="text-xs text-gray-500 tracking-wide mt-1">
                        {localeContent.curriculum.coreSubtitle}
                      </p>
                    )}
                  </div>
                </div>
                <ul className="space-y-4">
                  {localeContent.curriculum.coreCourses.map((course, index) => (
                    <li
                      key={`${course.code}-${index}`}
                      className="flex justify-between items-start border-b border-gray-200 pb-3"
                    >
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{course.code}</div>
                        <div className="text-gray-700">{course.name}</div>
                      </div>
                      <div className="text-sm text-gray-600 ml-4">{course.credits} ECTS</div>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-4 border-t-2 border-gray-900 flex justify-between font-bold text-gray-900">
                  <span>Total Core ECTS</span>
                  <span>
                    {localeContent.curriculum.coreCourses.reduce((acc, course) => acc + Number.parseInt(course.credits, 10), 0)} ECTS
                  </span>
                </div>
              </div>

              <div className="bg-white border border-gray-300 p-8">
                <div className="flex items-start mb-6 pb-4 border-b border-gray-300">
                  <BookOpen className="h-7 w-7 text-gray-900 mr-3 mt-1" />
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-gray-900">
                      {localeContent.curriculum.secondSemesterTitle ?? 'Core Curriculum'}
                    </h3>
                    {localeContent.curriculum.secondSemesterSubtitle && (
                      <p className="text-xs text-gray-500 tracking-wide mt-1">
                        {localeContent.curriculum.secondSemesterSubtitle}
                      </p>
                    )}
                  </div>
                </div>
                {secondSemesterCourses.length > 0 ? (
                  <>
                    <ul className="space-y-4">
                      {secondSemesterCourses.map((course, index) => (
                        <li
                          key={`${course.code}-${index}`}
                          className="flex justify-between items-start border-b border-gray-200 pb-3"
                        >
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{course.code}</div>
                            <div className="text-gray-700">{course.name}</div>
                          </div>
                          <div className="text-sm text-gray-600 ml-4">{course.credits} ECTS</div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 pt-4 border-t-2 border-gray-900 flex justify-between font-bold text-gray-900">
                      <span>Total Core ECTS</span>
                      <span>{totalSecondSemesterEcts} ECTS</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">Second semester courses will appear here once added.</p>
                )}
              </div>
            </div>

            {localeContent.curriculum.semesters && localeContent.curriculum.semesters.length > 0 && (
              <div className="mb-12">
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">Program Plan</h3>
                {/* Simple flowchart */}
                <div className="hidden md:flex items-center mb-8">
                  {localeContent.curriculum.semesters.map((sem, i) => (
                    <div key={`flow-${i}`} className="flex items-center">
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold">{i + 1}</div>
                        <span className="text-xs mt-2 text-gray-700">{sem.title}</span>
                      </div>
                      {i < localeContent.curriculum.semesters!.length - 1 && (
                        <div className="w-16 h-0.5 bg-gray-300 mx-3" />
                      )}
                    </div>
                  ))}
                  {localeContent.curriculum.thesis && (
                    <div className="flex items-center">
                      <div className="w-16 h-0.5 bg-gray-300 mx-3" />
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold">T</div>
                        <span className="text-xs mt-2 text-gray-700">Thesis</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Semesters accordion */}
                <div className="space-y-4">
                  {localeContent.curriculum.semesters.map((sem, semIndex) => {
                    const isSemesterOpen = !!openSemesters[semIndex];
                    return (
                      <div key={`sem-${semIndex}`} className="bg-white border border-gray-300">
                        <button
                          type="button"
                          onClick={() => toggleSemester(semIndex)}
                          className="w-full px-5 py-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 focus:outline-none"
                          aria-expanded={isSemesterOpen}
                        >
                          <div>
                            <h4 className="text-lg font-bold text-gray-900">{sem.title}</h4>
                            <p className="text-xs text-gray-600">{sem.courses.length} courses</p>
                          </div>
                          <ChevronRight className={`h-5 w-5 text-gray-600 transition-transform ${isSemesterOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {isSemesterOpen && (
                          <ul>
                            {sem.courses.map((course, idx) => {
                              const key = `${semIndex}-${course.code}`;
                              const open = !!openCourse[key];
                              return (
                                <li key={`${course.code}-${idx}`} className="border-b border-gray-200 last:border-0">
                                  <button
                                    type="button"
                                    onClick={() => toggleCourse(semIndex, course.code)}
                                    className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-gray-50"
                                  >
                                    <div className="mr-4">
                                      <div className="font-semibold text-gray-900">{course.code} · {course.name}</div>
                                      <div className="text-xs text-gray-600">{course.credits} ECTS</div>
                                    </div>
                                    <ChevronRight className={`h-5 w-5 text-gray-600 transition-transform ${open ? 'rotate-90' : ''}`} />
                                  </button>
                                  {course.description && open && (
                                    <div className="px-5 pb-4 bg-gray-50">
                                      <FormattedText
                                        text={course.description}
                                        className="text-sm text-gray-700"
                                      />
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                  {localeContent.curriculum.thesis && (
                    <div className="bg-white border-2 border-gray-900 p-5">
                      <h4 className="text-lg font-bold text-gray-900">{localeContent.curriculum.thesis.title ?? 'Thesis'}</h4>
                      <p className="text-sm text-gray-700 mt-1">{localeContent.curriculum.thesis.credits} ECTS</p>
                      {localeContent.curriculum.thesis.description && (
                        <FormattedText
                          text={localeContent.curriculum.thesis.description}
                          className="text-sm text-gray-700 mt-2"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-900 text-white p-8">
              <div className="grid md:grid-cols-4 gap-8">
                {localeContent.curriculum.creditBreakdown.map((item, index) => (
                  <div key={`${item.label}-${index}`}>
                    <div className="text-3xl font-serif font-bold mb-2">{item.value}</div>
                    <div className="text-sm text-gray-300 uppercase tracking-wide">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="research" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                {localeContent.research.title}
              </h2>
              <div className="w-24 h-1 bg-gray-900 mb-8" />
              <FormattedText
                text={localeContent.research.description}
                className="text-lg text-gray-700 leading-relaxed max-w-4xl"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {localeContent.research.areas.map((area, index) => {
                const IconComponent = iconMap[area.icon];
                return (
                  <RevealOnScroll key={`${area.title}-${index}`} delayMs={index * 80}>
                    <div className="bg-gray-50 border border-gray-300 p-6 hover:border-gray-900 transition-colors transition-transform hover:-translate-y-0.5 hover:shadow-md">
                      <IconComponent className="h-8 w-8 text-gray-900 mb-4" />
                      <h3 className="text-lg font-bold text-gray-900 mb-3">{area.title}</h3>
                      <FormattedText
                        text={area.description}
                        className="text-gray-700 text-sm leading-relaxed"
                      />
                    </div>
                  </RevealOnScroll>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faculty" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50 border-b border-gray-200">
          <div className="max-w-6xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                {localeContent.faculty.title}
              </h2>
              <div className="w-24 h-1 bg-gray-900 mb-8" />
              <FormattedText
                text={localeContent.faculty.description}
                className="text-lg text-gray-700 leading-relaxed max-w-4xl"
              />
            </div>

            <div className="grid md:grid-cols-4 gap-8">
              {localeContent.faculty.members.map((faculty, index) => (
                <button
                  key={`${faculty.name}-${index}`}
                  type="button"
                  onClick={() => handleSelectFaculty(index)}
                  className="text-left bg-white border border-gray-300 hover:border-gray-900 transition-colors overflow-hidden flex flex-col"
                >
                  <div className="relative w-full overflow-hidden aspect-[3/4]">
                    {faculty.photoDataUrl ? (
                      <img
                        src={faculty.photoDataUrl}
                        alt={faculty.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Users className="h-20 w-20 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-6 border-t border-gray-300 flex-1">
                    <h3 className="text-xl font-serif font-bold text-gray-900 mb-1 line-clamp-2">{faculty.name}</h3>
                    <p className="text-sm text-gray-600 mb-1 uppercase tracking-wide line-clamp-2">{faculty.title}</p>
                    <p className="text-sm text-gray-700 font-medium mb-3 line-clamp-1">{faculty.specialty}</p>
                    <div className="border-t border-gray-300 pt-3 mt-3 text-sm text-gray-700">
                      <p className="text-xs text-gray-600 mb-2 line-clamp-1">{faculty.education}</p>
                      <FormattedText
                        text={faculty.research}
                        className="line-clamp-2"
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="admissions" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto">
            <div className="mb-16">
              <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                {localeContent.admissions.title}
              </h2>
              <div className="w-24 h-1 bg-gray-900 mb-8" />
              <FormattedText
                text={localeContent.admissions.description}
                className="text-lg text-gray-700 leading-relaxed"
              />
            </div>

            <div className="bg-gray-50 border border-gray-300 p-8 mb-8">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">
                {localeContent.admissions.requirementsTitle}
              </h3>
              <div className="space-y-4">
                {localeContent.admissions.requirements.map((req, index) => (
                  <div
                    key={`${req.title}-${index}`}
                    className="flex items-start pb-4 border-b border-gray-300 last:border-0"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-900 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-gray-900 mb-1">{req.title}</div>
                      <FormattedText
                        text={req.description}
                        className="text-sm text-gray-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {localeContent.admissions.cards.map((card, index) => {
                const IconComponent = iconMap[card.icon];
                return (
                  <div key={`${card.title}-${index}`} className="bg-white border-2 border-gray-900 p-6">
                    <IconComponent className="h-8 w-8 text-gray-900 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{card.title}</h3>
                    <div className="space-y-2 mb-4 text-sm text-gray-700">
                      {card.details.map((detail, detailIndex) => (
                        <p key={`${detail.label}-${detailIndex}`}>
                          <strong>{detail.label}:</strong> {detail.value}
                        </p>
                      ))}
                    </div>
                    <a
                      href={card.ctaTarget}
                      className="inline-flex items-center text-gray-900 font-semibold hover:underline"
                    >
                      {card.ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-serif font-bold mb-6 text-center">{localeContent.contact.title}</h2>
            <div className="w-24 h-1 bg-white mb-8 mx-auto" />
            <FormattedText
              text={localeContent.contact.description}
              className="text-gray-300 text-lg mb-12 leading-relaxed text-center max-w-3xl mx-auto"
            />

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {localeContent.contact.cards.map((card, index) => {
                const IconComponent = iconMap[card.icon];
                return (
                  <div key={`${card.title}-${index}`} className="bg-gray-800 border border-gray-700 p-8 text-center hover:border-gray-600 transition-colors">
                    <div className="flex justify-center mb-4">
                      <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center">
                        <IconComponent className="h-8 w-8 text-gray-900" />
                      </div>
                    </div>
                    <h3 className="font-bold text-xl mb-3">{card.title}</h3>
                    <p className="text-gray-300 leading-relaxed">
                      {card.lines.map((line, lineIndex) => (
                        <span key={`${line}-${lineIndex}`} className="block">
                          {line}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
            
            <div className="text-center py-8 bg-gray-800 border border-gray-700 max-w-2xl mx-auto">
              <p className="text-gray-300 text-lg">{localeContent.contact.officeHours}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black text-gray-400 py-12 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-1.5 mb-4 md:mb-0">
              <div className="h-12 w-12">
                <img
                  src="/data/images/UoC_logo_white.png"
                  alt={`${localeContent.branding.institution} logo`}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold">{localeContent.footer.institution}</span>
                <span className="text-xs text-gray-500">{localeContent.footer.subheading}</span>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm">{localeContent.footer.copyright}</p>
              <p className="text-xs text-gray-500 mt-1">{localeContent.footer.legal}</p>
            </div>
          </div>
        </div>
      </footer>

      {selectedAnnouncement && selectedAnnouncementData && (
        <AnnouncementDetailOverlay
          announcement={selectedAnnouncementData}
          localeLabel={localeLabels[selectedAnnouncement.locale]}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}

      {selectedFaculty && selectedFacultyData && (
        <FacultyDetailOverlay
          faculty={selectedFacultyData}
          localeLabel={localeLabels[selectedFaculty.locale]}
          onClose={() => setSelectedFaculty(null)}
        />
      )}
    </div>
  );
}

type AnnouncementCardProps = {
  announcement: AnnouncementItem;
  onSelect: () => void;
};

function AnnouncementPreview({ announcement, onSelect }: AnnouncementCardProps) {
  return (
    <div className="bg-gray-50 border border-gray-300 p-6 flex flex-col justify-between transition-colors transition-transform hover:-translate-y-0.5 hover:shadow-md hover:border-gray-900">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {announcement.date}
        </p>
        <h3 className="text-lg font-bold text-gray-900 mb-3">{announcement.title}</h3>
        <FormattedText
          text={announcement.summary}
          className="text-sm text-gray-700 leading-relaxed line-clamp-4"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        {announcement.attachments.length > 0 && (
          <span className="inline-flex items-center space-x-1 bg-white border border-gray-300 px-2 py-1">
            <FileText className="h-3.5 w-3.5" />
            <span>{announcement.attachments.length} PDF</span>
          </span>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="ml-auto inline-flex items-center text-sm font-semibold text-gray-900 hover:underline"
        >
          View details <ArrowRight className="ml-1 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function findAnnouncement(content: SiteContent, selection: SelectedAnnouncement) {
  const localeAnnouncements = content[selection.locale].announcements.items;
  return localeAnnouncements.find((item) => item.id === selection.id) ?? null;
}

function isStoredState(value: unknown): value is StoredState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<StoredState>;
  return record.content !== undefined;
}

function isSiteContent(value: unknown): value is SiteContent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return 'en' in record || 'gr' in record;
}

export default App;
