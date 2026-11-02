'use client';

import { forwardRef } from 'react';
import { Button, Switch, type ButtonProps, type SwitchProps } from '@mantine/core';

type Tone = 'primary' | 'soft' | 'info-soft' | 'danger' | 'danger-soft' | 'danger-ghost';

/** Mantine's button variables, pointed at the design tokens so no named Mantine colour (green, red) is ever used for state. */
const TONES: Record<Tone, Record<string, string>> = {
  primary: {
    '--button-bg': 'var(--c-success-solid)',
    '--button-hover': 'var(--c-success-hover)',
    '--button-color': 'var(--c-on-solid)',
    '--button-bd': 'none',
  },
  soft: {
    '--button-bg': 'var(--c-success-soft)',
    '--button-hover': 'var(--c-success-line)',
    '--button-color': 'var(--c-success-text)',
    '--button-bd': '1px solid var(--c-success-line)',
  },
  'info-soft': {
    '--button-bg': 'var(--c-info-soft)',
    '--button-hover': 'var(--c-info-line)',
    '--button-color': 'var(--c-info-text)',
    '--button-bd': '1px solid var(--c-info-line)',
  },
  danger: {
    '--button-bg': 'var(--c-danger)',
    '--button-hover': 'var(--c-danger-strong)',
    '--button-color': 'var(--c-on-solid)',
    '--button-bd': 'none',
  },
  'danger-soft': {
    '--button-bg': 'var(--c-danger-soft)',
    '--button-hover': 'var(--c-danger-line)',
    '--button-color': 'var(--c-danger-text)',
    '--button-bd': '1px solid var(--c-danger-line)',
  },
  'danger-ghost': {
    '--button-bg': 'transparent',
    '--button-hover': 'var(--c-danger-soft)',
    '--button-color': 'var(--c-danger-text)',
    '--button-bd': 'none',
  },
};

export interface CoopButtonProps extends Omit<ButtonProps, 'color' | 'variant'> {
  tone?: Tone;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit';
  'aria-label'?: string;
}

/** The cooperative pages' coloured buttons: green for the main action, red for a rejection or removal, all from the token palette. */
export const CoopButton = forwardRef<HTMLButtonElement, CoopButtonProps>(function CoopButton({ tone = 'primary', style, ...rest }, ref) {
  return <Button ref={ref} {...rest} style={{ ...TONES[tone], ...(style as object) }} />;
});

/** A switch in the success token colour rather than a named Mantine colour. */
export function CoopSwitch(props: Omit<SwitchProps, 'color'>) {
  return <Switch {...props} style={{ '--switch-color': 'var(--c-success-solid)', ...(props.style as object) } as React.CSSProperties} />;
}
