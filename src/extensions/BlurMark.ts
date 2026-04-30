import { Mark, mergeAttributes } from '@tiptap/core';

export const BlurMark = Mark.create({
  name: 'blur',

  parseHTML() {
    return [{ tag: 'span[data-blur]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-blur': '' }), 0];
  },
});
