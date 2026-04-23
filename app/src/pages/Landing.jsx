import TopBar        from '../components/landing/TopBar';
import Header        from '../components/landing/Header';
import Features      from '../components/landing/Features';
import HowItWorks    from '../components/landing/HowItWorks';
import Testimonials  from '../components/landing/Testimonials';
import Pricing       from '../components/landing/Pricing';
import CtaSection    from '../components/landing/CtaSection';
import LandingFooter from '../components/landing/LandingFooter';

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <TopBar />
      <Header />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
