import proviaxxLogo from '../../assets/Proviaxx_logo.png';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white pt-16">
      <img
        src={proviaxxLogo}
        alt="Proviaxx"
        className="h-40 w-auto"
      />

      {/* Fill-up progress bar */}
      <div className="relative h-0.5 w-48 overflow-hidden bg-gray-100">
        <div className="h-full bg-blue-600 animate-fill-bar" />
      </div>

      <style>{`
        @keyframes fill-bar {
          0%   { width: 0%; }
          60%  { width: 85%; }
          85%  { width: 92%; }
          100% { width: 100%; }
        }
        .animate-fill-bar {
          animation: fill-bar 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
