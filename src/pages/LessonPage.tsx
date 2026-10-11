// /ders/:lessonId - focus-mode lesson player (outside the app shell). Boss lessons run as the
// module mastery test; ?atlama=1 takes a boss as a skip / placement test.
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getLesson, getModule, prevModule } from '../lib/content';
import { canTakeSkipTest, isModuleUnlocked, useProgress } from '../store/progress';
import LessonPlayer from '../components/lesson/LessonPlayer';
import BossPlayer from '../components/lesson/BossPlayer';
import { LessonLocked, LessonNotFound } from '../components/lesson/StatusScreens';
import '../styles/lesson.css';

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const lesson = getLesson(lessonId);
  const module = lesson ? getModule(lesson.moduleId) : undefined;
  const asSkipTest = params.get('atlama') === '1';
  const locked = useProgress((s) => {
    if (!module) return false;
    if (isModuleUnlocked(s, module)) return false;
    return !(lesson?.type === 'boss' && asSkipTest && canTakeSkipTest(s, module));
  });

  // Focus mode lives outside the shell, so the TopBar never updates the window title here.
  useEffect(() => {
    document.title = `${lesson ? lesson.title : 'Ders bulunamadı'} – Rusteach`;
  }, [lesson]);

  if (!lesson) return <LessonNotFound onNavigate={(to) => navigate(to)} />;
  if (locked && module)
    return <LessonLocked module={module} prevModule={prevModule(module)} title={lesson.title} onNavigate={(to) => navigate(to)} />;
  if (lesson.type === 'boss') return <BossPlayer key={lesson.id} lesson={lesson} module={module} asSkipTest={asSkipTest} />;
  return <LessonPlayer key={lesson.id} lesson={lesson} module={module} />;
}
