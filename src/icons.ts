import {
  FlaskConical,
  GraduationCap,
  Users,
  Database,
  Microscope,
  Brain,
  Dna,
  BookMarked,
  MapPin,
  Phone,
  Mail,
  Award,
  Calendar
} from 'lucide-react';

import type { IconKey, IconMap } from './types';

export const iconMap: IconMap = {
  flask: FlaskConical,
  graduation: GraduationCap,
  users: Users,
  database: Database,
  microscope: Microscope,
  brain: Brain,
  dna: Dna,
  bookmark: BookMarked,
  mapPin: MapPin,
  phone: Phone,
  mail: Mail,
  award: Award,
  calendar: Calendar,
};

export const iconOptions: { value: IconKey; label: string }[] = [
  { value: 'flask', label: 'Flask / Research' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'users', label: 'People' },
  { value: 'database', label: 'Database' },
  { value: 'microscope', label: 'Microscope' },
  { value: 'brain', label: 'Brain' },
  { value: 'dna', label: 'DNA' },
  { value: 'bookmark', label: 'Bookmark' },
  { value: 'mapPin', label: 'Map Pin' },
  { value: 'phone', label: 'Phone' },
  { value: 'mail', label: 'Mail' },
  { value: 'award', label: 'Award' },
  { value: 'calendar', label: 'Calendar' },
];
