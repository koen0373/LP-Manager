import React, { useState } from 'react';
import { GetServerSideProps, NextApiRequest, NextApiResponse } from 'next';
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

  // Water background is now visible on all pages
  // Removed the no-water-bg class toggle

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
    // Import the API handler directly instead of making an HTTP fetch
    // This avoids CORS/network issues on the server side
    const handler = (await import('../api/pool/[tokenId]')).default;
    
    // Create mock request/response objects
    const mockReq = {
      method: 'GET',
      query: { tokenId },
      headers: {},
      cookies: {},
      body: undefined,
    } as unknown as NextApiRequest;
    
    let responseData: PoolDetailVM | null = null;
    let responseError: string | null = null;
    let responseStatus = 200;
    
    const mockRes = {
      status: (code: number) => {
        responseStatus = code;
        return mockRes;
      },
      json: (data: PoolDetailVM | { error: string }) => {
        if (responseStatus >= 400) {
          responseError = (data as { error: string }).error || 'Failed to load pool data';
        } else {
          responseData = data as PoolDetailVM;
        }
        return mockRes;
      },
    } as unknown as NextApiResponse;
    
    await handler(mockReq, mockRes);
    
    if (responseError || !responseData) {
      throw new Error(responseError || 'Failed to load pool data');
    }
    
    return {
      props: {
        tokenId,
        initialData: responseData
      }
    };
  } catch (error) {
    console.error('Error fetching pool data in getServerSideProps:', error);
    
    // Return error page
    return {
      props: {
        tokenId: tokenId as string,
        initialData: null,
        error: error instanceof Error ? error.message : 'Failed to load pool data'
      }
    };
  }
};
