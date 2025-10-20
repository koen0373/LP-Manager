import React from 'react';

export default function LPManagerPage() {
  return (
    <div className="min-h-screen bg-enosys-bg text-enosys-text">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Enosys LP Manager</h1>
          <p className="text-enosys-subtext">Manage your Enosys V3 liquidity positions on Flare Network</p>
        </div>

        <div className="bg-enosys-card rounded-lg border border-enosys-border p-6">
          <h2 className="text-xl font-semibold mb-4">LP Positions</h2>
          <div className="space-y-4">
            <div className="p-4 bg-enosys-bg rounded border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">WFLR - USDTO</h3>
                  <p className="text-sm text-enosys-subtext">Position #21790</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">$3.01</p>
                  <p className="text-sm text-green-500">Active</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-enosys-bg rounded border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">FXRP - USDTO</h3>
                  <p className="text-sm text-enosys-subtext">Position #21798</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">$0.00</p>
                  <p className="text-sm text-green-500">Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}