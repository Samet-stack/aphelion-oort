import React from 'react';

interface StackProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const gapMap = {
  0: 'gap-0',
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-5',
  6: 'gap-6',
};

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: '',
};

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

export const Stack: React.FC<StackProps> = ({
  children,
  direction = 'column',
  gap = 2,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  style,
}) => {
  const classes = [
    'flex',
    direction === 'column' ? 'flex-col' : 'flex-row',
    gapMap[gap],
    alignMap[align],
    justifyMap[justify],
    wrap ? 'flex-wrap' : 'flex-nowrap',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
};

// Shorthand components
export const Row: React.FC<Omit<StackProps, 'direction'>> = (props) => (
  <Stack direction="row" {...props} />
);

export const Column: React.FC<Omit<StackProps, 'direction'>> = (props) => (
  <Stack direction="column" {...props} />
);
