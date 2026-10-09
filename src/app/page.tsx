import { CtaBand } from "@/components/home/cta-band";
import { Hero } from "@/components/home/hero";
import { Highlights } from "@/components/home/highlights";
import { RecentScores } from "@/components/home/recent-scores";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <Highlights />
      <RecentScores />
      <CtaBand />
    </div>
  );
}
