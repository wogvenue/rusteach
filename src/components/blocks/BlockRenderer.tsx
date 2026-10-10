// Renders any lesson block with its interactive component. Used by the lesson player, the review
// session and the practice page (see ./types.ts for the contract).
import type { BlockProps } from './types';
import MdBlock from './MdBlock';
import CodeBlock from './CodeBlock';
import QuizBlock from './QuizBlock';
import PredictBlock from './PredictBlock';
import CompilesBlock from './CompilesBlock';
import FillBlock from './FillBlock';
import ParsonsBlock from './ParsonsBlock';
import ExerciseBlock from './ExerciseBlock';
import FlashcardsBlock from './FlashcardsBlock';
import MemoryDiagram from './MemoryDiagram';
import ReflectBlock from './ReflectBlock';
import '../../styles/lesson.css';

export default function BlockRenderer(props: BlockProps) {
  const { block } = props;
  switch (block.type) {
    case 'md':
      return <MdBlock {...props} block={block} />;
    case 'code':
      return <CodeBlock {...props} block={block} />;
    case 'quiz':
      return <QuizBlock {...props} block={block} />;
    case 'predict':
      return <PredictBlock {...props} block={block} />;
    case 'compiles':
      return <CompilesBlock {...props} block={block} />;
    case 'fill':
      return <FillBlock {...props} block={block} />;
    case 'parsons':
      return <ParsonsBlock {...props} block={block} />;
    case 'exercise':
      return <ExerciseBlock {...props} block={block} />;
    case 'flashcards':
      return <FlashcardsBlock {...props} block={block} />;
    case 'memory':
      return <MemoryDiagram {...props} block={block} />;
    case 'reflect':
      return <ReflectBlock {...props} block={block} />;
    default:
      return null;
  }
}
