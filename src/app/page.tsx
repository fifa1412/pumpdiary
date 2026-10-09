import { redirect } from "next/navigation";

// The songs catalog is the front page.
export default function Home() {
  redirect("/songs");
}
