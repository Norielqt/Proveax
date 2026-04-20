import TopBar    from '../components/landing/TopBar';
import Header    from '../components/landing/Header';
import PublicMap from '../components/landing/PublicMap';
import Pricing   from '../components/landing/Pricing';

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopBar />
      <Header />
      <section className="w-full">
        <div className="h-[500px] md:h-[600px] w-full">
          <PublicMap />
        </div>
      </section>
      <Pricing />
    </div>
  );
}
