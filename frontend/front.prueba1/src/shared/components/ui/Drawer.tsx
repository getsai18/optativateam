import type { ReactNode } from 'react';
import { Overlay } from './Overlay';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer(props: DrawerProps) {
  return <Overlay {...props} side="right" />;
}
