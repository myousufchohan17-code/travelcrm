import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useUi } from "../../context/UiContext";
import welcomeImage from "../../images/welcome.webp";
import discoverImage from "../../images/discover.webp";

export default function HeroSection() {
  const { user, loading } = useAuth();
  const { openModal } = useUi();
  const firstName = !loading && user?.full_name ? user.full_name.split(" ")[0] : "";

  return (
    <div className="hero-section">
      <article
        className="hero-card hero-card-welcome"
        style={{ "--hero-image": `url(${welcomeImage})` }}
      >
        <div className="hero-card-body">
          <h2>
            {loading ? "Welcome Back!" : `Welcome Back${firstName ? `, ${firstName}` : ""}!`}
          </h2>
          <p>Manage your clients, bookings and travel packages all in one place.</p>
        </div>
      </article>

      <article
        className="hero-card hero-card-discover"
        style={{ "--hero-image": `url(${discoverImage})` }}
      >
        <div className="hero-card-body">
          <p className="hero-kicker">Premium Journeys</p>
          <h3>Discover new horizons</h3>
          <p>Create a booking and start the next trip.</p>
          <button type="button" onClick={() => openModal("booking")}>
            <Plus className="h-4 w-4 shrink-0" /> New Booking
          </button>
        </div>
      </article>
    </div>
  );
}
