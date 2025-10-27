export function RangeStatus({ inRange }: { inRange: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span 
        className={`inline-block w-3 h-3 rounded-full ${
          inRange 
            ? 'bg-enosys-accentGreen shadow-lg shadow-enosys-accentGreen/50' 
            : 'bg-enosys-accentRed shadow-lg shadow-enosys-accentRed/50'
        }`} 
      />
      <span className={`text-[15px] font-medium ${
        inRange ? 'text-enosys-accentGreen' : 'text-enosys-accentRed'
      }`}>
        {inRange ? 'In Range' : 'Out of Range'}
      </span>
    </div>
  );
}

export function PositionStatus({ status }: { status: 'Active' | 'Inactive' | 'Closed' }) {
  return (
    <span className={`text-[15px] font-medium ${
      status === 'Active' 
        ? 'text-enosys-text' 
        : 'text-enosys-inactive'
    }`}>
      {status}
    </span>
  );
}
