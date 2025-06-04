
"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const pageAuth = (WrappedComponent: React.ComponentType<any>) => {
  const Wrapper = (props: any) => {
    const router = useRouter();
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
      const key = localStorage.getItem('token');
      if (!key) {
        router.replace('/login');
      } else {
        setIsVerified(true);
      }
    }, [router]);

    if (!isVerified) return null;

    return <WrappedComponent {...props} />;
  };

  return Wrapper;
};

export default pageAuth; // ✅ This is important!
