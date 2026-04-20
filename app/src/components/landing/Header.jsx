import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="w-full bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20 text-center">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900">
          Find off-market properties
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg text-gray-600">
          Property intelligence for real estate teams. Search, filter, and skip-trace —
          all in one place. Start your 7-day free trial, no credit card required.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/register" className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            Start free trial
          </Link>
          <a href="#pricing" className="rounded-md px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            See pricing →
          </a>
        </div>
      </div>
    </header>
  );
}
