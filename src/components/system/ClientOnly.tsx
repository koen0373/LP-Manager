'use client';

import React from 'react';

type ClientOnlyProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default ClientOnly;
