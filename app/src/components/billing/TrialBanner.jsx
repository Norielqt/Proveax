import { Link } from 'react-router-dom';

export default function TrialBanner({ daysLeft }) {
  const urgent = daysLeft !== null && daysLeft <= 2;
  return (
    <div className={`px-4 py-2 text-sm ${urgent ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <span>
          {daysLeft > 0
            ? `You're on a free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`
            : `Your trial ends today.`}
        </span>
        <Link to="/subscription" className="font-semibold underline">Upgrade →</Link>
      </div>
    </div>
  );
}
