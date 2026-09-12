import { Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { FooterLinkProps } from './types';

export default function FooterLink({ to, onClick, children }: FooterLinkProps) {
  const style = {
    color: 'fg.muted',
    fontSize: 'sm',
    _hover: { color: 'brand.text', textDecoration: 'none' },
  } as const;

  if (to) {
    return (
      <Link asChild {...style}>
        <RouterLink to={to}>{children}</RouterLink>
      </Link>
    );
  }
  /* A form, not a mailto: the visitor may have no mail client wired up, and a
     link that opens nothing reads as a dead end. */
  return (
    <Link as="button" type="button" textAlign="left" onClick={onClick} {...style}>
      {children}
    </Link>
  );
}
