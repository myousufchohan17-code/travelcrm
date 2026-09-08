import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useUi } from "../../context/UiContext";
import welcomeImage from "../../images/welcome.webp";
import discoverImage from "../../images/discover.webp";

export default function HeroSection() {
  const { user } = useAuth();
  const { openModal } = useUi();
  const firstName = (user?.full_name || "there").split(" ")[0];

  return (
    <div className="grid min-w-0 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-[1.65fr_1fr]">
      <div className="relative min-h-[180px] overflow-hidden rounded-2xl sm:min-h-[210px] lg:min-h-[240px]">
        <img src={welcomeImage} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/80 via-navy-900/45 to-navy-900/10" />
        <div className="relative flex h-full min-h-[180px] flex-col justify-end p-4 sm:min-h-[210px] sm:p-6 lg:min-h-[240px] lg:p-7">
          <h2 className="break-words text-lg font-extrabold text-white sm:text-2xl lg:text-3xl">Welcome Back, {firstName}!</h2>
          <p className="mt-2 max-w-md text-xs leading-5 text-white/85 sm:text-sm">
            Manage your clients, bookings and travel packages all in one place.
          </p>
        </div>
      </div>

      <div className="relative min-h-[180px] overflow-hidden rounded-2xl sm:min-h-[210px] lg:min-h-[240px]">
        <img src={discoverImage} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-900/35 to-transparent" />
        <div className="relative flex h-full min-h-[180px] flex-col justify-end p-4 sm:min-h-[210px] sm:p-6 lg:min-h-[240px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 sm:text-[11px]">Premium Journeys</p>
          <h3 className="mt-1 text-base font-extrabold text-white sm:text-xl">Discover new horizons</h3>
          <p className="mt-1 text-xs text-white/80 sm:text-sm">Create a booking and start the next trip.</p>
          <button
            onClick={() => openModal("booking")}
            className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-700 shadow-sm hover:bg-brand-50 sm:mt-4 sm:px-4"
          >
            <Plus className="h-4 w-4" /> New Booking
          </button>
        </div>
      </div>
    </div>
  );
}
