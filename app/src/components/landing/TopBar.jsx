import { Link } from 'react-router-dom';

export default function TopBar() {
  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">P</div>
          <span className="text-lg font-semibold text-gray-900">PropIntel</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Log in
          </Link>
          <Link to="/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
