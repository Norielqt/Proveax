/** Shimmer block — use className to set w/h/rounded */
export function Sk({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

/** 4-column stat-card row */
export function StatCardsSkeleton({ cols = 4 }) {
  return (
    <div className={`grid gap-3 grid-cols-2 md:grid-cols-${cols}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-white px-4 py-3 space-y-2">
          <Sk className="h-3 w-20" />
          <Sk className="h-7 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Generic bar chart placeholder */
export function ChartSkeleton() {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <Sk className="mb-4 h-4 w-32" />
      <div className="flex h-40 items-end gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t bg-gray-200"
            style={{ height: `${30 + Math.round(Math.sin(i) * 30 + 40)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Generic table skeleton */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <table className="table-fixed w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-3 py-2.5">
                <Sk className="h-3 w-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-3 py-3">
                  <Sk className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Settings form skeleton */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-1">
        <Sk className="h-6 w-40" />
        <Sk className="h-4 w-64" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Sk className="h-3.5 w-28" />
          <Sk className="h-9 w-full rounded-md" />
        </div>
      ))}
      <div className="space-y-1.5">
        <Sk className="h-3.5 w-28" />
        <Sk className="h-28 w-full rounded-md" />
      </div>
      <Sk className="h-9 w-24 rounded-md" />
    </div>
  );
}

/** Screenshot grid skeleton */
export function ScreenshotGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Sk className="aspect-video w-full rounded-none" />
          <div className="space-y-1.5 p-2">
            <Sk className="h-3 w-3/4" />
            <Sk className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
