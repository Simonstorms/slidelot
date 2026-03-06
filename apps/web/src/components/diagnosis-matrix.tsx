interface DiagnosisMatrixProps {
  quadrants: {
    winner: number;
    wrong_audience: number;
    weak_hook: number;
    dud: number;
  };
}

export function DiagnosisMatrix({ quadrants }: DiagnosisMatrixProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="border rounded-lg p-4 bg-green-50">
        <div className="text-sm font-medium text-green-700">
          Winner
        </div>
        <div className="text-2xl font-bold text-green-800">
          {quadrants.winner}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          High views + High conversions
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-yellow-50">
        <div className="text-sm font-medium text-yellow-700">
          Wrong Audience
        </div>
        <div className="text-2xl font-bold text-yellow-800">
          {quadrants.wrong_audience}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          High views + Low conversions
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="text-sm font-medium text-blue-700">
          Weak Hook
        </div>
        <div className="text-2xl font-bold text-blue-800">
          {quadrants.weak_hook}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Low views + High conversions
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-red-50">
        <div className="text-sm font-medium text-red-700">
          Dud
        </div>
        <div className="text-2xl font-bold text-red-800">
          {quadrants.dud}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Low views + Low conversions
        </div>
      </div>
    </div>
  );
}
