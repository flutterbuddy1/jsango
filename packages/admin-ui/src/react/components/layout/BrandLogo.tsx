import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext.js';

/** Initials of the admin title ("Shop Admin" → "SA"), used when no logo is configured. */
function initials(title: string): string {
  const words = title.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? 'JS').slice(0, 2)).toUpperCase();
}

/** The admin logo: the configured image, or a badge with `logoText` / the title's initials. */
export const BrandLogo: React.FC<{ size: number }> = ({ size }) => {
  const { config } = useAdmin();
  const [broken, setBroken] = useState(false);
  if (config.logoUrl && !broken) {
    return (
      <img
        src={config.logoUrl}
        alt={config.title}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: Math.round(size / 4), flexShrink: 0 }}
      />
    );
  }
  return (
    <div className="header-brand-badge" aria-hidden style={{ width: size, height: size, fontSize: size * 0.42, borderRadius: Math.round(size / 4) }}>
      {config.logoText || initials(config.title)}
    </div>
  );
};
