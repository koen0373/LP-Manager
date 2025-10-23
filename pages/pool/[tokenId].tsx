import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import { PoolPairDetail } from '@/features/poolDetail/PoolPairDetail';
import { PoolDetailVM } from '@/features/poolDetail/types';

interface PoolPageProps {
  tokenId: string;
  initialData: PoolDetailVM | null;
  error?: string;
}

export default function PoolPage({ tokenId, initialData, error: serverError }: PoolPageProps) {
  const [vm, setVm] = useState<PoolDetailVM | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(serverError);

  const handleRefresh = async () => {
    setLoading(true);
    setError(undefined);
    
    try {
      const response = await fetch(`/api/pool/${tokenId}?refresh=1`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch pool data: ${response.status}`);
      }
      
      const freshData: PoolDetailVM = await response.json();
      setVm(freshData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  if (!vm && !error) {
    return (
      <PoolPairDetail
        vm={{} as PoolDetailVM}
        loading={true}
        onRefresh={handleRefresh}
      />
    );
  }

  if (!vm) {
    return (
      <PoolPairDetail
        vm={{} as PoolDetailVM}
        loading={false}
        error={error}
        onRefresh={handleRefresh}
      />
    );
  }

  return (
    <PoolPairDetail
      vm={vm}
      onRefresh={handleRefresh}
      loading={loading}
      error={error}
    />
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { tokenId } = context.params!;
  
  try {
    // Fetch live data from our API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/pool/${tokenId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pool data: ${response.status}`);
    }
    
    const initialData: PoolDetailVM = await response.json();
    
    return {
      props: {
        tokenId,
        initialData
      }
    };
  } catch (error) {
    console.error('Error fetching pool data in getServerSideProps:', error);
    
    // Return error page
    return {
      props: {
        tokenId,
        initialData: null,
        error: error instanceof Error ? error.message : 'Failed to load pool data'
      }
    };
  }
};
