import { Link } from 'react-router-dom';
import logo from '../../assets/Proveax_loading.png';

export default function TopBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[#E8F0FB] bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-10">
        <Link to="/">
          <img src={logo} alt="Proveax" className="h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-[#185FA5] transition-colors hover:bg-[#E6F1FB]"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] px-5 py-2 text-sm font-medium text-white shadow-sm shadow-[#185FA5]/20 transition-all hover:shadow-md hover:shadow-[#185FA5]/30"
          >
            Get started free
          </Link>
        </div>
      </div>
    </nav>
  );
}
