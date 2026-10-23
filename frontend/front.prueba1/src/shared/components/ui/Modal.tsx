import type { ReactNode } from 'react';
import { Overlay } from './Overlay';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: string;
  widthClass?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal(props: ModalProps) {
  return <Overlay {...props} side="center" />;
}
