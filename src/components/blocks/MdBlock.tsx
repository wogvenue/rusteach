import type { MdBlock as MdBlockT } from '../../types/content';
import type { BlockProps } from './types';
import Html from './Html';

export default function MdBlock({ block }: BlockProps<MdBlockT>) {
  return <Html html={block.html} />;
}
