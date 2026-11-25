import { createFileRoute } from "@tanstack/react-router";
import { Mesa } from "@/components/mesa";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <Mesa />;
}
