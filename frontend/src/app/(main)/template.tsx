'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Page enter transition — template.tsx remounts per navigation (SECTION 9). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
